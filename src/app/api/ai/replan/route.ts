import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { getCurrentUser } from "@/utils/supabase/server";
import { db } from "@/server/db";
import { goals, roadmaps, stages, vMilestoneStatus, milestoneDependencies, tasks, focusSessions } from "@/server/db/schema";
import { eq, and, isNull, inArray, gte, desc, asc } from "drizzle-orm";
import { z } from "zod";
import { format, subDays, isAfter, isBefore } from "date-fns";

export const maxDuration = 45;

const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY || "",
  headers: {
    "HTTP-Referer": "http://localhost:3000",
    "X-Title": "Personal Intelligence Workspace",
  },
});

const replanSchema = z.object({
  milestones: z.array(
    z.object({
      milestone_id: z.string().describe("The exact UUID of the milestone being rescheduled"),
      new_date: z.string().describe("Proposed new due date in ISO YYYY-MM-DD format"),
      reason: z.string().describe("Clear, concise reason explaining the schedule change based on dependencies and velocity"),
    })
  ),
  target_date_breached: z.boolean().describe("True if the latest proposed milestone date extends beyond the goal target date"),
  suggested_scope_cut: z.string().nullable().optional().describe("If target_date_breached is true, provide actionable scope cut or milestone deferral options"),
  summary: z.string().describe("A concise summary of the revised timeline and execution strategy"),
});

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { goalId, blackoutDates = [] } = body;

    if (!goalId) {
      return new Response(JSON.stringify({ error: "goalId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 1. Fetch Goal details
    const [goal] = await db
      .select()
      .from(goals)
      .where(and(eq(goals.id, goalId), eq(goals.userId, user.id), isNull(goals.deletedAt)))
      .limit(1);

    if (!goal) {
      return new Response(JSON.stringify({ error: "Goal not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2. Fetch Roadmap & Stages
    const [roadmap] = await db
      .select()
      .from(roadmaps)
      .where(and(eq(roadmaps.goalId, goalId), eq(roadmaps.userId, user.id), isNull(roadmaps.deletedAt)))
      .limit(1);

    if (!roadmap) {
      return new Response(JSON.stringify({ error: "Roadmap not found for this goal" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const stageRows = await db
      .select()
      .from(stages)
      .where(and(eq(stages.roadmapId, roadmap.id), eq(stages.userId, user.id), isNull(stages.deletedAt)))
      .orderBy(asc(stages.ordinal), asc(stages.createdAt));

    const stageIds = stageRows.map((s) => s.id);
    if (stageIds.length === 0) {
      return new Response(JSON.stringify({ error: "No stages found on this roadmap" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 3. Fetch Milestones with derived status from v_milestone_status
    const milestoneRows = await db
      .select()
      .from(vMilestoneStatus)
      .where(and(inArray(vMilestoneStatus.stageId, stageIds), eq(vMilestoneStatus.userId, user.id)))
      .orderBy(asc(vMilestoneStatus.ordinal), asc(vMilestoneStatus.createdAt));

    const milestoneIds = milestoneRows.map((m) => m.id);

    // 4. Fetch Dependencies
    const dependencyRows = milestoneIds.length > 0
      ? await db
          .select({
            predecessorId: milestoneDependencies.predecessorId,
            successorId: milestoneDependencies.successorId,
          })
          .from(milestoneDependencies)
          .where(inArray(milestoneDependencies.predecessorId, milestoneIds))
      : [];

    // 5. Calculate 4-Week Velocity (completed tasks & focus minutes in the last 28 days)
    const fourWeeksAgo = subDays(new Date(), 28);
    const recentCompletedTasks = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, user.id),
          eq(tasks.status, "done"),
          gte(tasks.updatedAt, fourWeeksAgo),
          isNull(tasks.deletedAt)
        )
      );

    const recentSessions = await db
      .select()
      .from(focusSessions)
      .where(and(eq(focusSessions.userId, user.id), gte(focusSessions.startedAt, fourWeeksAgo)));

    const totalRecentTasks = recentCompletedTasks.length;
    const tasksPerWeek = Math.max(1, (totalRecentTasks / 4)).toFixed(1);
    const totalFocusMinutes = recentSessions.reduce((acc, s) => acc + (s.minutes || 0), 0);
    const focusHoursPerWeek = (totalFocusMinutes / 60 / 4).toFixed(1);

    // Prepare structured context for AI
    const roadmapGraph = {
      goal: {
        id: goal.id,
        title: goal.title,
        description: goal.description,
        target_date: goal.targetDate ? format(new Date(goal.targetDate), "yyyy-MM-dd") : null,
      },
      current_date: format(new Date(), "yyyy-MM-dd"),
      velocity: {
        period: "Past 4 weeks",
        completed_tasks_per_week: Number(tasksPerWeek),
        focus_hours_per_week: Number(focusHoursPerWeek),
      },
      blackout_dates: blackoutDates,
      stages: stageRows.map((s) => ({
        id: s.id,
        title: s.title,
        ordinal: s.ordinal,
      })),
      milestones: milestoneRows.map((m) => ({
        id: m.id,
        stage_id: m.stageId,
        title: m.title,
        definition_of_done: m.definitionOfDone,
        est_hours: m.estHours ? Number(m.estHours) : 4,
        due_date: m.dueDate ? format(new Date(m.dueDate), "yyyy-MM-dd") : null,
        completed_at: m.completedAt ? format(new Date(m.completedAt), "yyyy-MM-dd") : null,
        derived_status: m.derivedStatus,
        total_tasks: m.totalTasks,
        completed_tasks: m.completedTasks,
        blocked_by_predecessor_ids: m.incompletePredecessorIds,
      })),
      dependencies: dependencyRows.map((d) => ({
        predecessor_id: d.predecessorId,
        successor_id: d.successorId,
      })),
    };

    const prompt = `You are AI-09, an expert project planner and execution intelligence engine.
Analyze the provided roadmap graph, current velocity, dependencies, and slipped/blocked milestones.

TASK:
Produce a realistic re-planned schedule for any pending, slipped, or at-risk milestones.
1. Respect milestone dependency order: a successor milestone MUST NOT be scheduled before its predecessor is completed.
2. Consider the user's velocity (${tasksPerWeek} tasks/wk, ${focusHoursPerWeek} focus hrs/wk).
3. Do not reschedule already completed milestones.
4. Avoid scheduling milestones on blackout dates (${JSON.stringify(blackoutDates)}).
5. If the new schedule pushes the final milestone past the goal target date (${roadmapGraph.goal.target_date || "None"}), set target_date_breached = true and recommend a specific scope cut or non-essential milestone deferral in suggested_scope_cut.
6. The goal target date itself must NEVER be silently moved.

GRAPH DATA:
${JSON.stringify(roadmapGraph, null, 2)}`;

    // Model selection: Claude Sonnet 3.5 or configured model with resilient fallback
    const preferredModel =
      process.env.REPLAN_MODEL ||
      process.env.OPENROUTER_MODEL ||
      "anthropic/claude-3.5-sonnet:beta";

    let rawReplan: z.infer<typeof replanSchema>;

    try {
      const result = await generateObject({
        model: openrouter.chat(preferredModel),
        schema: replanSchema,
        prompt,
        temperature: 0.2,
        providerOptions: {
          openai: {
            maxCompletionTokens: 1200,
          },
        },
      });
      rawReplan = result.object;
    } catch (modelErr: any) {
      console.warn(`[AI-09] Primary model ${preferredModel} failed, trying fallback model google/gemini-2.5-flash:`, modelErr?.message);
      const fallbackResult = await generateObject({
        model: openrouter.chat("google/gemini-2.5-flash"),
        schema: replanSchema,
        prompt,
        temperature: 0.2,
        providerOptions: {
          openai: {
            maxCompletionTokens: 1200,
          },
        },
      });
      rawReplan = fallbackResult.object;
    }

    // Guardrail 1: Server-side Dependency Topological Ordering Verification
    const milestoneDateMap = new Map<string, Date>();
    const originalMilestoneMap = new Map(milestoneRows.map((m) => [m.id, m]));

    // Initialize with existing dates or proposed dates
    for (const m of milestoneRows) {
      if (m.dueDate) {
        milestoneDateMap.set(m.id, new Date(m.dueDate));
      }
    }
    for (const p of rawReplan.milestones) {
      const parsed = new Date(p.new_date);
      if (!isNaN(parsed.getTime())) {
        milestoneDateMap.set(p.milestone_id, parsed);
      }
    }

    // Enforce predecessor <= successor constraint
    let repairedMilestones = [...rawReplan.milestones];
    for (const dep of dependencyRows) {
      const predDate = milestoneDateMap.get(dep.predecessorId);
      const succDate = milestoneDateMap.get(dep.successorId);

      if (predDate && succDate && isAfter(predDate, succDate)) {
        // Successor was scheduled before predecessor - push successor to at least 1 day after predecessor
        const adjustedSuccDate = new Date(predDate.getTime() + 24 * 60 * 60 * 1000);
        milestoneDateMap.set(dep.successorId, adjustedSuccDate);

        const succEntryIndex = repairedMilestones.findIndex((m) => m.milestone_id === dep.successorId);
        if (succEntryIndex >= 0) {
          repairedMilestones[succEntryIndex].new_date = format(adjustedSuccDate, "yyyy-MM-dd");
          repairedMilestones[succEntryIndex].reason += " (Adjusted to respect predecessor dependency order)";
        } else {
          repairedMilestones.push({
            milestone_id: dep.successorId,
            new_date: format(adjustedSuccDate, "yyyy-MM-dd"),
            reason: "Adjusted to maintain dependency sequence with predecessor",
          });
        }
      }
    }

    // Guardrail 2: Verify Goal Target Date Breach
    let targetDateBreached = rawReplan.target_date_breached;
    if (goal.targetDate) {
      const goalTarget = new Date(goal.targetDate);
      for (const m of repairedMilestones) {
        const mDate = new Date(m.new_date);
        if (isAfter(mDate, goalTarget)) {
          targetDateBreached = true;
          break;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        replan: {
          milestones: repairedMilestones,
          target_date_breached: targetDateBreached,
          suggested_scope_cut: rawReplan.suggested_scope_cut,
          summary: rawReplan.summary,
        },
        velocity: {
          tasksPerWeek: Number(tasksPerWeek),
          focusHoursPerWeek: Number(focusHoursPerWeek),
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[/api/ai/replan] Error during re-planning:", error);
    return new Response(
      JSON.stringify({
        error: error?.message || "Failed to generate AI re-planning schedule",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
