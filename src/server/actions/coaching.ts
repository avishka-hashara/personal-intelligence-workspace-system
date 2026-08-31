"use server";

import { db } from "@/server/db";
import { coachingNudges, habits, habitLogs, goals, tasks, milestones } from "@/server/db/schema";
import { eq, and, isNull, gte, desc, sql, inArray } from "drizzle-orm";
import { getCurrentUser } from "@/utils/supabase/server";
import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { subDays, format } from "date-fns";

const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY || "",
  headers: {
    "HTTP-Referer": "http://localhost:3000",
    "X-Title": "Personal Intelligence Workspace",
  },
});

// Guardrail regex: Discard any output containing shame, guilt, or harsh absolutes (with word boundaries)
const FORBIDDEN_PATTERN = /\b(shame|guilt|guilty|fail|failed|failing|fails|failure|must|always|never|should|disappointed|disappointing)\b/i;

const nudgeOutputSchema = z.object({
  text: z
    .string()
    .describe("1-3 concise, warm, encouraging plain text sentences (plain text, no markdown headers)"),
  cta_url: z
    .string()
    .nullable()
    .optional()
    .describe("Optional single relative navigation URL (e.g., /habits, /plan/goals, /study/courses)"),
});

export type CoachingNudgeItem = typeof coachingNudges.$inferSelect;

/**
 * AI-10 Nudge Generator Action
 * Enforces:
 * 1. Hard-cap at 2 nudges per day per user
 * 2. Claude Haiku 4.5 generation (max_tokens: 220, temperature: 0.7)
 * 3. Post-generation Anti-Shame Regex Guardrail
 * 4. Deterministic fallback substitution if flagged
 */
export async function generateNudge(
  trigger: string,
  contextData: any = {}
): Promise<CoachingNudgeItem | null> {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  try {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    // 1. Rate Limit Guardrail: Query coaching_nudges count created today
    const todayNudges = await db
      .select({ id: coachingNudges.id })
      .from(coachingNudges)
      .where(
        and(
          eq(coachingNudges.userId, user.id),
          gte(coachingNudges.createdAt, todayStart)
        )
      );

    // Hard-cap at 2 nudges per day
    if (todayNudges.length >= 2) {
      console.log(`[AI-10] User ${user.id} has already received ${todayNudges.length} nudges today. Rate limit enforced.`);
      return null;
    }

    // 2. Prepare Deterministic Fallback Template
    let fallbackText = "Gentle check-in: Taking one small step today keeps your momentum alive.";
    let fallbackCtaUrl: string | null = "/";

    if (trigger === "habit_streak_at_risk") {
      const habitNames = contextData.habitNames || (contextData.habitName ? [contextData.habitName] : ["Habit"]);
      const count = contextData.habitCount || habitNames.length;
      if (count === 1) {
        const streak = contextData.streak ? `${contextData.streak}-day streak` : "active streak";
        fallbackText = `${habitNames[0]}: ${streak}, not yet logged today.`;
      } else if (count === 2) {
        fallbackText = `${habitNames[0]} & ${habitNames[1]}: 2 active streaks waiting for check-in today.`;
      } else {
        fallbackText = `${habitNames[0]} and ${count - 1} other habits: active streaks waiting for check-in today.`;
      }
      fallbackCtaUrl = "/#habits";
    } else if (trigger === "goal_inactivity") {
      const goalTitle = contextData.goalTitle || "Active Goal";
      fallbackText = `${goalTitle}: 3+ days since your last milestone progress. Ready for a small next step?`;
      fallbackCtaUrl = "/plan/goals";
    }

    // 3. Call AI Gateway (Claude Haiku 4.5, max_tokens: 220, temperature: 0.7)
    const preferredModel =
      process.env.NUDGE_MODEL ||
      process.env.OPENROUTER_HAIKU_MODEL ||
      "anthropic/claude-haiku-4.5";

    const prompt = `You are AI-10, a compassionate, supportive executive function coach for a personal intelligence workspace.
A behavioral trigger has fired: "${trigger}".
Context details: ${JSON.stringify(contextData)}

GUIDELINES:
1. Write exactly 1 to 3 sentences of warm, encouraging, plain text coaching.
2. Be empathetic, constructive, and forward-looking.
3. If multiple habits are at risk (e.g. 2 or more), give a unified gentle reminder covering them without being overwhelming.
4. CRITICAL ETHICAL RULE: Never use guilt, shame, blame, or forceful words (do NOT use words like must, should, failed, always, never, disappointed).
5. Provide an optional single call-to-action link (e.g., /#habits or /plan/goals) if relevant.`;

    let generatedText = fallbackText;
    let generatedCtaUrl: string | null = fallbackCtaUrl;

    try {
      const response = await generateObject({
        model: openrouter.chat(preferredModel),
        schema: nudgeOutputSchema,
        prompt,
        temperature: 0.7,
        providerOptions: {
          openai: {
            maxCompletionTokens: 220,
          },
        },
      });

      if (response.object.text && response.object.text.trim().length > 0) {
        generatedText = response.object.text.trim();
        generatedCtaUrl = response.object.cta_url ?? fallbackCtaUrl;
      }
    } catch (aiErr: any) {
      console.warn(
        `[AI-10] Model ${preferredModel} failed (${aiErr?.message}), trying resilient fallback google/gemini-2.5-flash...`
      );
      try {
        const fallbackRes = await generateObject({
          model: openrouter.chat("google/gemini-2.5-flash"),
          schema: nudgeOutputSchema,
          prompt,
          temperature: 0.7,
          providerOptions: {
            openai: {
              maxCompletionTokens: 220,
            },
          },
        });
        if (fallbackRes.object.text && fallbackRes.object.text.trim().length > 0) {
          generatedText = fallbackRes.object.text.trim();
          generatedCtaUrl = fallbackRes.object.cta_url ?? fallbackCtaUrl;
        }
      } catch (fallbackErr: any) {
        console.warn("[AI-10] Fallback model failed, using deterministic template:", fallbackErr?.message);
        generatedText = fallbackText;
        generatedCtaUrl = fallbackCtaUrl;
      }
    }

    // 4. Post-generation Regex Guardrail
    if (FORBIDDEN_PATTERN.test(generatedText)) {
      console.warn(
        `[AI-10] Post-generation regex guardrail flagged forbidden keyword in output: "${generatedText}". Discarding and using deterministic fallback.`
      );
      generatedText = fallbackText;
      generatedCtaUrl = fallbackCtaUrl;
    }

    // 5. Insert valid nudge into database
    const [inserted] = await db
      .insert(coachingNudges)
      .values({
        userId: user.id,
        text: generatedText,
        ctaUrl: generatedCtaUrl || null,
      })
      .returning();

    return inserted;
  } catch (error) {
    console.error("[AI-10] Failed to generate coaching nudge:", error);
    return null;
  }
}

/**
 * Fetch the latest nudge created today for the authenticated user
 */
export async function getTodayNudge(): Promise<CoachingNudgeItem | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [latestNudge] = await db
      .select()
      .from(coachingNudges)
      .where(
        and(
          eq(coachingNudges.userId, user.id),
          gte(coachingNudges.createdAt, todayStart)
        )
      )
      .orderBy(desc(coachingNudges.createdAt))
      .limit(1);

    return latestNudge ?? null;
  } catch (error) {
    console.error("[AI-10] Failed to fetch today's nudge:", error);
    return null;
  }
}

/**
 * Evaluates triggers and generates a nudge if conditions are met and no nudge exists today
 */
export async function checkAndTriggerNudge(): Promise<CoachingNudgeItem | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const now = new Date();
    const todayStr = format(now, "yyyy-MM-dd");
    const yesterdayStr = format(subDays(now, 1), "yyyy-MM-dd");

    // 1. Check if user already has a nudge today
    const existing = await getTodayNudge();
    if (existing) {
      return existing;
    }

    // 2. Trigger 1: Habit streak at risk
    // Find active habits
    const activeHabits = await db
      .select()
      .from(habits)
      .where(and(eq(habits.userId, user.id), eq(habits.active, true), isNull(habits.deletedAt)))
      .limit(10);

    if (activeHabits.length > 0) {
      const habitIds = activeHabits.map((h) => h.id);

      // Check today's logs
      const todayLogs = await db
        .select()
        .from(habitLogs)
        .where(
          and(
            eq(habitLogs.userId, user.id),
            inArray(habitLogs.habitId, habitIds),
            eq(habitLogs.loggedOn, todayStr),
            isNull(habitLogs.deletedAt)
          )
        );

      const loggedHabitIds = new Set(todayLogs.map((l) => l.habitId));

      // Find an unlogged habit that was logged yesterday (streak at risk)
      const yesterdayLogs = await db
        .select()
        .from(habitLogs)
        .where(
          and(
            eq(habitLogs.userId, user.id),
            inArray(habitLogs.habitId, habitIds),
            eq(habitLogs.loggedOn, yesterdayStr),
            isNull(habitLogs.deletedAt)
          )
        );

      const yesterdayLoggedIds = new Set(yesterdayLogs.map((l) => l.habitId));

      const atRiskHabits = activeHabits.filter(
        (h) => !loggedHabitIds.has(h.id) && yesterdayLoggedIds.has(h.id)
      );

      if (atRiskHabits.length > 0) {
        const habitNames = atRiskHabits.map((h) => h.title);
        return await generateNudge("habit_streak_at_risk", {
          habitIds: atRiskHabits.map((h) => h.id),
          habitNames,
          habitCount: atRiskHabits.length,
          habitName: habitNames[0],
          summary:
            atRiskHabits.length === 1
              ? habitNames[0]
              : atRiskHabits.length === 2
              ? `${habitNames[0]} & ${habitNames[1]}`
              : `${habitNames[0]} and ${atRiskHabits.length - 1} other habits`,
        });
      }
    }

    // 3. Trigger 2: 3+ days of zero activity on an active goal
    const threeDaysAgo = subDays(now, 3);
    const activeGoals = await db
      .select()
      .from(goals)
      .where(and(eq(goals.userId, user.id), eq(goals.status, "active"), isNull(goals.deletedAt)))
      .limit(5);

    for (const g of activeGoals) {
      // Check for recent tasks completed for this goal
      const recentTasks = await db
        .select({ id: tasks.id })
        .from(tasks)
        .where(
          and(
            eq(tasks.userId, user.id),
            gte(tasks.updatedAt, threeDaysAgo),
            isNull(tasks.deletedAt)
          )
        )
        .limit(1);

      if (recentTasks.length === 0) {
        // Goal has been inactive for 3+ days
        return await generateNudge("goal_inactivity", {
          goalId: g.id,
          goalTitle: g.title,
          daysInactive: 3,
        });
      }
    }

    return null;
  } catch (error) {
    console.error("[AI-10] Error in checkAndTriggerNudge:", error);
    return null;
  }
}
