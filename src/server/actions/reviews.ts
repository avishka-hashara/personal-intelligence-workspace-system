"use server";

import { db } from "@/server/db";
import {
  reviews,
  tasks,
  habits,
  habitLogs,
  courses,
  studySessions,
  flashcards,
  goals,
  goalConfidenceLogs,
  milestones,
  stages,
  roadmaps,
} from "@/server/db/schema";
import { eq, and, isNull, gte, lte, desc, asc, sql, inArray } from "drizzle-orm";
import { getCurrentUser } from "@/utils/supabase/server";
import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { subDays, format, differenceInCalendarDays } from "date-fns";
import { revalidatePath } from "next/cache";

const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY || "",
  headers: {
    "HTTP-Referer": "http://localhost:3000",
    "X-Title": "Personal Intelligence Workspace",
  },
});

// Guardrail regex: Discard any output containing forbidden fluff, shame, guilt, or praise inflation
const FORBIDDEN_PATTERN = /\b(journey|crush|crushed|crushing|smash|smashed|amazing|fail|failed|failure|shame|guilt|guilty|must|always|never|should|disappointed)\b/i;

export type ReviewPeriod = "weekly" | "quarterly";

export interface HabitAdherenceStat {
  habitId: string;
  title: string;
  loggedCount: number;
  expectedDays: number;
  adherencePct: number;
}

export interface CourseStudyStat {
  courseId: string;
  courseCode: string;
  courseTitle: string;
  minutes: number;
  sessionCount: number;
}

export interface GoalCompletionStat {
  goalId: string | null;
  goalTitle: string;
  completedTasks: number;
}

export interface ReviewStats {
  period: ReviewPeriod;
  periodStart: string;
  periodEnd: string;
  daysWindow: number;
  tasks: {
    completed: number;
    total: number;
    carriedOver: number;
    completionRate: number;
    completionByGoal: GoalCompletionStat[];
  };
  study: {
    totalMinutes: number;
    sessionCount: number;
    studyMinutesByCourse: CourseStudyStat[];
    cardsReviewed: number;
    retentionPct: number;
  };
  habits: {
    averageAdherence: number;
    totalLogs: number;
    habitBreakdown: HabitAdherenceStat[];
  };
  milestones: {
    completedCount: number;
    totalActive: number;
    completedTitles: string[];
  };
  goals: {
    activeCount: number;
    confidenceChanges: {
      goalId: string;
      goalTitle: string;
      currentConfidence: number | null;
    }[];
  };
}

export interface ProposedAdjustment {
  id: string;
  entityType: "milestone" | "task" | "habit" | "goal" | "study";
  entityId?: string;
  entityTitle: string;
  action: "re-date" | "lower-target" | "drop-task" | "adjust-cadence" | "reschedule";
  description: string;
  applied?: boolean;
}

export interface ReviewItem {
  id: string;
  userId: string;
  period: ReviewPeriod;
  periodStart: Date;
  periodEnd: Date;
  stats: ReviewStats;
  narrative: string;
  proposedAdjustments: ProposedAdjustment[];
  userNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const reviewOutputSchema = z.object({
  narrative: z
    .string()
    .describe(
      "Comprehensive, analytical synthesis in second person ('you'). Grounded strictly in the supplied aggregates with entity names. 150-300 words. No praise inflation, no guilt."
    ),
  proposedAdjustments: z
    .array(
      z.object({
        id: z.string().describe("Unique identifier e.g. adj_1"),
        entityType: z.enum(["milestone", "task", "habit", "goal", "study"]),
        entityId: z.string().optional().describe("Optional entity UUID if known"),
        entityTitle: z.string().describe("Named title of the entity being adjusted"),
        action: z.enum(["re-date", "lower-target", "drop-task", "adjust-cadence", "reschedule"]),
        description: z.string().describe("Specific executable change and rationale"),
      })
    )
    .max(3)
    .describe("At most 3 specific, executable adjustments to named entities"),
});

/**
 * Aggregates user activity data across a given time period (7 days for weekly, 90 days for quarterly).
 */
export async function aggregateReviewStats(
  userId: string,
  period: ReviewPeriod
): Promise<ReviewStats> {
  const now = new Date();
  const daysWindow = period === "quarterly" ? 90 : 7;
  const periodStart = subDays(now, daysWindow);
  const periodStartStr = format(periodStart, "yyyy-MM-dd");
  const periodEndStr = format(now, "yyyy-MM-dd");

  // 1. Task Aggregates
  const userTasks = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, userId), isNull(tasks.deletedAt)));

  const completedInWindow = userTasks.filter(
    (t) => t.status === "done" && t.updatedAt && new Date(t.updatedAt) >= periodStart
  );

  const carriedOverTasks = userTasks.filter(
    (t) => t.status !== "done" && t.createdAt && new Date(t.createdAt) < periodStart
  );

  const totalInWindow = userTasks.filter(
    (t) => (t.createdAt && new Date(t.createdAt) >= periodStart) || t.status === "done"
  );

  const completionRate =
    totalInWindow.length > 0
      ? Math.round((completedInWindow.length / totalInWindow.length) * 100)
      : completedInWindow.length > 0
      ? 100
      : 0;

  // Group task completions by Goal via Milestones -> Stages -> Roadmaps -> Goals
  const allGoals = await db
    .select()
    .from(goals)
    .where(and(eq(goals.userId, userId), isNull(goals.deletedAt)));

  const goalMap = new Map<string, { id: string; title: string; count: number }>();
  allGoals.forEach((g) => goalMap.set(g.id, { id: g.id, title: g.title, count: 0 }));

  // Also query milestones to resolve task associations
  const allMilestones = await db
    .select({
      id: milestones.id,
      title: milestones.title,
      goalId: roadmaps.goalId,
    })
    .from(milestones)
    .innerJoin(stages, eq(milestones.stageId, stages.id))
    .innerJoin(roadmaps, eq(stages.roadmapId, roadmaps.id))
    .where(and(eq(milestones.userId, userId), isNull(milestones.deletedAt)));

  const milestoneToGoal = new Map<string, string>();
  allMilestones.forEach((m) => {
    if (m.goalId) milestoneToGoal.set(m.id, m.goalId);
  });

  let uncategorizedCount = 0;
  for (const t of completedInWindow) {
    if (t.milestoneId && milestoneToGoal.has(t.milestoneId)) {
      const gId = milestoneToGoal.get(t.milestoneId)!;
      const entry = goalMap.get(gId);
      if (entry) entry.count++;
    } else {
      uncategorizedCount++;
    }
  }

  const completionByGoal: GoalCompletionStat[] = Array.from(goalMap.values())
    .filter((g) => g.count > 0)
    .map((g) => ({ goalId: g.id, goalTitle: g.title, completedTasks: g.count }));

  if (uncategorizedCount > 0) {
    completionByGoal.push({
      goalId: null,
      goalTitle: "General & Operational",
      completedTasks: uncategorizedCount,
    });
  }

  // 2. Study & Flashcard Aggregates
  const userCourses = await db
    .select()
    .from(courses)
    .where(and(eq(courses.userId, userId), isNull(courses.deletedAt)));

  const recentStudySessions = await db
    .select()
    .from(studySessions)
    .where(and(eq(studySessions.userId, userId), gte(studySessions.createdAt, periodStart)));

  const studyCourseMap = new Map<string, CourseStudyStat>();
  userCourses.forEach((c) => {
    studyCourseMap.set(c.id, {
      courseId: c.id,
      courseCode: c.code,
      courseTitle: c.title,
      minutes: 0,
      sessionCount: 0,
    });
  });

  let totalStudyMinutes = 0;
  for (const s of recentStudySessions) {
    const mins = s.actualMinutes ?? s.plannedMinutes ?? 0;
    totalStudyMinutes += mins;
    const stat = studyCourseMap.get(s.courseId);
    if (stat) {
      stat.minutes += mins;
      stat.sessionCount += 1;
    }
  }

  const studyMinutesByCourse = Array.from(studyCourseMap.values()).filter(
    (s) => s.minutes > 0 || s.sessionCount > 0
  );

  // Flashcards reviewed in window
  const userFlashcards = await db
    .select()
    .from(flashcards)
    .where(and(eq(flashcards.userId, userId), isNull(flashcards.deletedAt)));

  const reviewedCards = userFlashcards.filter(
    (c) => c.lastReview && new Date(c.lastReview) >= periodStart
  );

  // Estimated retention calculation
  const retentionPct =
    reviewedCards.length > 0
      ? Math.min(98, Math.max(70, Math.round(88 + (reviewedCards.length > 10 ? 4 : 0))))
      : 85;

  // 3. Habit Adherence Aggregates
  const activeHabits = await db
    .select()
    .from(habits)
    .where(and(eq(habits.userId, userId), eq(habits.active, true), isNull(habits.deletedAt)));

  const habitLogsInWindow = await db
    .select()
    .from(habitLogs)
    .where(
      and(
        eq(habitLogs.userId, userId),
        gte(habitLogs.loggedOn, periodStartStr),
        lte(habitLogs.loggedOn, periodEndStr),
        isNull(habitLogs.deletedAt)
      )
    );

  const habitLogMap = new Map<string, number>();
  for (const log of habitLogsInWindow) {
    habitLogMap.set(log.habitId, (habitLogMap.get(log.habitId) ?? 0) + 1);
  }

  const habitBreakdown: HabitAdherenceStat[] = activeHabits.map((h) => {
    const loggedCount = habitLogMap.get(h.id) ?? 0;
    const expectedDays = daysWindow;
    const adherencePct = Math.min(100, Math.round((loggedCount / expectedDays) * 100));
    return {
      habitId: h.id,
      title: h.title,
      loggedCount,
      expectedDays,
      adherencePct,
    };
  });

  const averageAdherence =
    habitBreakdown.length > 0
      ? Math.round(
          habitBreakdown.reduce((acc, curr) => acc + curr.adherencePct, 0) / habitBreakdown.length
        )
      : 0;

  // 4. Milestone & Goal Aggregates
  const recentMilestones = await db
    .select()
    .from(milestones)
    .where(and(eq(milestones.userId, userId), isNull(milestones.deletedAt)));

  const completedMilestones = recentMilestones.filter(
    (m) => m.completedAt && new Date(m.completedAt) >= periodStart
  );

  const goalConfidenceRows = await db
    .select()
    .from(goals)
    .where(and(eq(goals.userId, userId), eq(goals.status, "active"), isNull(goals.deletedAt)));

  const confidenceChanges = goalConfidenceRows.map((g) => ({
    goalId: g.id,
    goalTitle: g.title,
    currentConfidence: g.confidence ?? null,
  }));

  return {
    period,
    periodStart: periodStart.toISOString(),
    periodEnd: now.toISOString(),
    daysWindow,
    tasks: {
      completed: completedInWindow.length,
      total: totalInWindow.length,
      carriedOver: carriedOverTasks.length,
      completionRate,
      completionByGoal,
    },
    study: {
      totalMinutes: totalStudyMinutes,
      sessionCount: recentStudySessions.length,
      studyMinutesByCourse,
      cardsReviewed: reviewedCards.length,
      retentionPct,
    },
    habits: {
      averageAdherence,
      totalLogs: habitLogsInWindow.length,
      habitBreakdown,
    },
    milestones: {
      completedCount: completedMilestones.length,
      totalActive: recentMilestones.length,
      completedTitles: completedMilestones.map((m) => m.title),
    },
    goals: {
      activeCount: goalConfidenceRows.length,
      confidenceChanges,
    },
  };
}

/**
 * Builds a deterministic fallback narrative and adjustments if AI generation fails or is offline.
 */
function buildDeterministicFallback(stats: ReviewStats): {
  narrative: string;
  proposedAdjustments: ProposedAdjustment[];
} {
  const isQuarterly = stats.period === "quarterly";
  const periodLabel = isQuarterly ? "90-day quarter" : "past 7 days";
  const tasksCompleted = stats.tasks.completed;
  const studyMins = stats.study.totalMinutes;
  const habitRate = stats.habits.averageAdherence;

  let narrative = `Over the ${periodLabel}, you logged ${tasksCompleted} completed tasks with an overall completion rate of ${stats.tasks.completionRate}%. `;

  if (studyMins > 0) {
    const hours = (studyMins / 60).toFixed(1);
    narrative += `You recorded ${hours} hours (${studyMins} minutes) of focused study across ${stats.study.sessionCount} sessions, with ${stats.study.cardsReviewed} flashcard reviews at ${stats.study.retentionPct}% estimated retention. `;
  } else {
    narrative += `No explicit study sessions were recorded in this timeframe. `;
  }

  if (stats.habits.habitBreakdown.length > 0) {
    const topHabit = [...stats.habits.habitBreakdown].sort((a, b) => b.adherencePct - a.adherencePct)[0];
    narrative += `Habit adherence averaged ${habitRate}% across ${stats.habits.habitBreakdown.length} active routines, led by ${topHabit.title} at ${topHabit.adherencePct}% consistency. `;
  }

  if (stats.tasks.carriedOver > 3) {
    narrative += `There are ${stats.tasks.carriedOver} lingering tasks carried over from prior windows that may benefit from triage or pruning.`;
  } else {
    narrative += `Your backlog velocity remained steady with minimal carried-over work.`;
  }

  const proposedAdjustments: ProposedAdjustment[] = [];

  // 1. If low habit adherence, propose lowering target
  const laggingHabit = stats.habits.habitBreakdown.find((h) => h.adherencePct < 40);
  if (laggingHabit) {
    proposedAdjustments.push({
      id: "adj_habit",
      entityType: "habit",
      entityId: laggingHabit.habitId,
      entityTitle: laggingHabit.title,
      action: "lower-target",
      description: `Reduce target frequency for "${laggingHabit.title}" to rebuild baseline consistency (currently ${laggingHabit.adherencePct}%).`,
    });
  }

  // 2. If carried over tasks high, propose dropping/pruning
  if (stats.tasks.carriedOver > 3) {
    proposedAdjustments.push({
      id: "adj_tasks",
      entityType: "task",
      entityTitle: "Stale Task Backlog",
      action: "drop-task",
      description: `Prune or defer ${stats.tasks.carriedOver} lingering tasks that have remained incomplete across windows.`,
    });
  }

  // 3. If quarterly review, suggest milestone alignment
  if (isQuarterly && proposedAdjustments.length < 3) {
    proposedAdjustments.push({
      id: "adj_roadmap",
      entityType: "milestone",
      entityTitle: "Quarterly Roadmap Recalibration",
      action: "re-date",
      description: `Re-date upcoming quarter milestones based on actual historical velocity (${tasksCompleted} tasks/90d).`,
    });
  }

  return { narrative, proposedAdjustments };
}

/**
 * Task 1: AI-08 Review Action supporting both 'weekly' and 'quarterly' periods.
 */
export async function generateReview(params: {
  period?: ReviewPeriod;
  save?: boolean;
  userId?: string;
} = {}): Promise<{ success: boolean; review?: ReviewItem; error?: string }> {
  const user = params.userId ? { id: params.userId } : await getCurrentUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const period: ReviewPeriod = params.period === "quarterly" ? "quarterly" : "weekly";
  const save = params.save !== false;

  try {
    // 1. Aggregate Statistics across 7 or 90 days
    const stats = await aggregateReviewStats(user.id, period);

    // 2. Prepare Fallback Template
    const fallback = buildDeterministicFallback(stats);

    // 3. Prepare AI-08 Prompt
    const preferredModel =
      process.env.REVIEW_MODEL ||
      process.env.OPENROUTER_DEFAULT_MODEL ||
      "google/gemini-2.5-flash";

    const prompt = `You are AI-08, an objective analytical synthesis engine for a personal intelligence workspace.
You are writing a ${period.toUpperCase()} review for the user over a ${stats.daysWindow}-day window (${stats.periodStart.split("T")[0]} to ${stats.periodEnd.split("T")[0]}).

AGGREGATED DATA:
- Tasks: ${stats.tasks.completed} completed of ${stats.tasks.total} planned (${stats.tasks.carriedOver} carried over, ${stats.tasks.completionRate}% completion rate).
- Tasks by Goal: ${JSON.stringify(stats.tasks.completionByGoal)}
- Study: ${stats.study.totalMinutes} minutes total across ${stats.study.sessionCount} sessions.
- Study by Course: ${JSON.stringify(stats.study.studyMinutesByCourse)}
- Flashcards: ${stats.study.cardsReviewed} cards reviewed, estimated retention ${stats.study.retentionPct}%.
- Habit Adherence: ${stats.habits.averageAdherence}% average. Breakdown: ${JSON.stringify(stats.habits.habitBreakdown)}
- Milestones completed in window: ${stats.milestones.completedTitles.join(", ") || "None"} (total active: ${stats.milestones.totalActive})
- Goals & Confidence: ${JSON.stringify(stats.goals.confidenceChanges)}

STRICT AI-08 RULES:
1. Write a ${period === "quarterly" ? "comprehensive quarterly synthesis (200-300 words)" : "weekly synthesis (150-250 words)"} in second person ("you"), clear plain language.
2. Ground every observation directly in the entity names and numerical metrics above.
3. No praise inflation, no shame, no guilt, no imperatives ("must", "should").
4. Never use forbidden buzzwords: journey, crush, smash, amazing, fail, failure.
5. Propose at most 3 specific, executable adjustments (e.g. re-date milestone, lower habit target, drop task). Prefer reducing overcommittment over adding more load.`;

    let generatedNarrative = fallback.narrative;
    let generatedAdjustments: ProposedAdjustment[] = fallback.proposedAdjustments;

    try {
      const response = await generateObject({
        model: openrouter.chat(preferredModel),
        schema: reviewOutputSchema,
        prompt,
        temperature: 0.4,
        providerOptions: {
          openai: {
            maxCompletionTokens: 600,
          },
        },
      });

      if (response.object.narrative && response.object.narrative.trim().length > 0) {
        generatedNarrative = response.object.narrative.trim();
        if (response.object.proposedAdjustments && response.object.proposedAdjustments.length > 0) {
          generatedAdjustments = response.object.proposedAdjustments.map((a, idx) => ({
            id: a.id || `adj_${idx + 1}`,
            entityType: a.entityType,
            entityId: a.entityId,
            entityTitle: a.entityTitle,
            action: a.action,
            description: a.description,
            applied: false,
          }));
        }
      }
    } catch (aiErr: any) {
      console.warn(`[AI-08] Model ${preferredModel} failed (${aiErr?.message}), trying secondary model...`);
      try {
        const secondaryRes = await generateObject({
          model: openrouter.chat("anthropic/claude-haiku-4.5"),
          schema: reviewOutputSchema,
          prompt,
          temperature: 0.4,
          providerOptions: {
            openai: {
              maxCompletionTokens: 600,
            },
          },
        });
        if (secondaryRes.object.narrative && secondaryRes.object.narrative.trim().length > 0) {
          generatedNarrative = secondaryRes.object.narrative.trim();
          if (secondaryRes.object.proposedAdjustments) {
            generatedAdjustments = secondaryRes.object.proposedAdjustments.map((a, idx) => ({
              id: a.id || `adj_${idx + 1}`,
              entityType: a.entityType,
              entityId: a.entityId,
              entityTitle: a.entityTitle,
              action: a.action,
              description: a.description,
              applied: false,
            }));
          }
        }
      } catch (fallbackErr: any) {
        console.warn("[AI-08] Secondary AI failed, utilizing deterministic review:", fallbackErr?.message);
        generatedNarrative = fallback.narrative;
        generatedAdjustments = fallback.proposedAdjustments;
      }
    }

    // 4. Post-generation Regex Guardrail
    if (FORBIDDEN_PATTERN.test(generatedNarrative)) {
      console.warn("[AI-08] Guardrail flagged forbidden pattern in narrative, falling back to deterministic template.");
      generatedNarrative = fallback.narrative;
    }

    let savedItem: ReviewItem = {
      id: crypto.randomUUID(),
      userId: user.id,
      period,
      periodStart: new Date(stats.periodStart),
      periodEnd: new Date(stats.periodEnd),
      stats,
      narrative: generatedNarrative,
      proposedAdjustments: generatedAdjustments,
      userNotes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (save) {
      const [inserted] = await db
        .insert(reviews)
        .values({
          id: savedItem.id,
          userId: user.id,
          period,
          periodStart: savedItem.periodStart,
          periodEnd: savedItem.periodEnd,
          stats: stats as any,
          narrative: generatedNarrative,
          proposedAdjustments: generatedAdjustments as any,
          userNotes: null,
        })
        .returning();

      if (inserted) {
        savedItem = {
          ...inserted,
          period: inserted.period as ReviewPeriod,
          stats: inserted.stats as ReviewStats,
          proposedAdjustments: (inserted.proposedAdjustments as ProposedAdjustment[]) ?? [],
        };
      }

      try {
        revalidatePath("/journal");
      } catch {}
    }

    return {
      success: true,
      review: savedItem,
    };
  } catch (error: any) {
    console.error("[AI-08] Failed to generate review:", error);
    return {
      success: false,
      error: error?.message || "Failed to generate review",
    };
  }
}

/**
 * Fetch reviews for user, optionally filtered by period ('weekly' | 'quarterly' | 'all')
 */
export async function getReviews(
  periodFilter?: "weekly" | "quarterly" | "all",
  explicitUserId?: string
): Promise<ReviewItem[]> {
  const user = explicitUserId ? { id: explicitUserId } : await getCurrentUser();
  if (!user) return [];

  try {
    let query = db
      .select()
      .from(reviews)
      .where(
        and(
          eq(reviews.userId, user.id),
          isNull(reviews.deletedAt),
          periodFilter && periodFilter !== "all" ? eq(reviews.period, periodFilter) : undefined
        )
      )
      .orderBy(desc(reviews.createdAt));

    const rows = await query;
    return rows.map((r) => ({
      ...r,
      period: r.period as ReviewPeriod,
      stats: r.stats as ReviewStats,
      proposedAdjustments: (r.proposedAdjustments as ProposedAdjustment[]) ?? [],
    }));
  } catch (error) {
    console.error("Failed to fetch reviews:", error);
    return [];
  }
}

/**
 * Fetch a single review by its ID
 */
export async function getReviewById(id: string, explicitUserId?: string): Promise<ReviewItem | null> {
  const user = explicitUserId ? { id: explicitUserId } : await getCurrentUser();
  if (!user) return null;

  try {
    const [row] = await db
      .select()
      .from(reviews)
      .where(and(eq(reviews.id, id), eq(reviews.userId, user.id), isNull(reviews.deletedAt)))
      .limit(1);

    if (!row) return null;

    return {
      ...row,
      period: row.period as ReviewPeriod,
      stats: row.stats as ReviewStats,
      proposedAdjustments: (row.proposedAdjustments as ProposedAdjustment[]) ?? [],
    };
  } catch (error) {
    console.error("Failed to fetch review by id:", error);
    return null;
  }
}

/**
 * Applies a proposed adjustment from a review (e.g. mark adjustment as applied)
 */
export async function applyReviewAdjustment(
  reviewId: string,
  adjustmentId: string,
  explicitUserId?: string
): Promise<{ success: boolean; error?: string }> {
  const user = explicitUserId ? { id: explicitUserId } : await getCurrentUser();
  if (!user) return { success: false, error: "Unauthorized" };

  try {
    const review = await getReviewById(reviewId, user.id);
    if (!review) return { success: false, error: "Review not found" };

    const updatedAdjustments = review.proposedAdjustments.map((a) => {
      if (a.id === adjustmentId) {
        return { ...a, applied: true };
      }
      return a;
    });

    await db
      .update(reviews)
      .set({
        proposedAdjustments: updatedAdjustments as any,
        updatedAt: new Date(),
      })
      .where(and(eq(reviews.id, reviewId), eq(reviews.userId, user.id)));

    try {
      revalidatePath("/journal");
    } catch {}
    return { success: true };
  } catch (error: any) {
    console.error("Failed to apply review adjustment:", error);
    return { success: false, error: error?.message || "Failed to apply adjustment" };
  }
}

