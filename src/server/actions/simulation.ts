"use server";

import { db } from "@/server/db";
import { tasks, habits, habitLogs, metricDefinitions, metricLogs } from "@/server/db/schema";
import { eq, and, isNull, notInArray, gte, inArray } from "drizzle-orm";
import { getCurrentUser } from "@/utils/supabase/server";
import { subDays, format } from "date-fns";
import { revalidatePath } from "next/cache";

export interface TaskPayloadItem {
  id?: string;
  title: string;
  estimated_hours: number;
  due_date?: string | null;
}

export interface HabitPayloadItem {
  name: string;
  adherence_rate: number;
}

export interface HealthMetricsPayload {
  sleep_hours: number;
  sleep_baseline: number;
  stress_level: number;
}

export interface CurrentStatePayload {
  tasks: TaskPayloadItem[];
  habits: HabitPayloadItem[];
  health_metrics: HealthMetricsPayload;
}

export interface DailyRiskScore {
  date: string;
  task_load: number;
  burnout_risk: number;
  risk_level: string;
}

export interface SimulationResult {
  predicted_bottleneck_dates: string[];
  risk_scores: DailyRiskScore[];
  alternate_schedule_recommendations: string[];
}

export interface SimulationResponse {
  success: boolean;
  data?: SimulationResult;
  error?: string;
}

export interface TaskOptimizationUpdate {
  id?: string;
  title: string;
  original_due_date?: string | null;
  optimized_due_date: string;
  assigned_day_offset: number;
}

export interface OptimizedScheduleResult {
  before_peak_risk: number;
  after_peak_risk: number;
  risk_reduction_percent: number;
  optimized_risk_timeline: DailyRiskScore[];
  task_updates: TaskOptimizationUpdate[];
}

export interface OptimizeScheduleResponse {
  success: boolean;
  data?: OptimizedScheduleResult;
  error?: string;
}

/**
 * Server Action: Queries real user data from Postgres (tasks, habits, sleep metrics),
 * constructs the CurrentState payload, and calls the Python FastAPI simulator engine.
 */
export async function runLifeSimulation(): Promise<SimulationResponse> {
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: "Unauthorized. Please log in to run simulations." };
  }

  try {
    const currentState = await buildCurrentStateForUser(user.id);
    const simulatorUrls = getSimulatorUrls("/simulate/timeline");

    let lastError = "";

    for (const url of simulatorUrls) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(currentState),
          cache: "no-store",
        });

        if (res.ok) {
          const resultData: SimulationResult = await res.json();
          return { success: true, data: resultData };
        } else {
          lastError = `Simulator server error (${res.status}): ${await res.text()}`;
        }
      } catch (err: any) {
        lastError = err.message || "Connection refused";
      }
    }

    return {
      success: false,
      error: `Could not connect to Python Simulator Engine. Ensure uvicorn server is running. (${lastError})`,
    };
  } catch (error: any) {
    console.error("runLifeSimulation Server Action Error:", error);
    return {
      success: false,
      error: error.message || "Failed to execute life simulation",
    };
  }
}

/**
 * Server Action: Calls the DEAP Genetic Algorithm optimizer in piw-simulator
 * to generate a flattened task schedule and calculate risk reduction metrics.
 */
export async function optimizeSchedule(): Promise<OptimizeScheduleResponse> {
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: "Unauthorized. Please log in." };
  }

  try {
    const currentState = await buildCurrentStateForUser(user.id);
    const optimizerUrls = getSimulatorUrls("/simulate/optimize");

    let lastError = "";

    for (const url of optimizerUrls) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(currentState),
          cache: "no-store",
        });

        if (res.ok) {
          const resultData: OptimizedScheduleResult = await res.json();
          return { success: true, data: resultData };
        } else {
          lastError = `Optimizer server error (${res.status}): ${await res.text()}`;
        }
      } catch (err: any) {
        lastError = err.message || "Connection refused";
      }
    }

    return {
      success: false,
      error: `Could not connect to Genetic Optimizer. Ensure uvicorn server is running. (${lastError})`,
    };
  } catch (error: any) {
    console.error("optimizeSchedule Server Action Error:", error);
    return {
      success: false,
      error: error.message || "Failed to optimize schedule",
    };
  }
}

/**
 * Server Action: Applies the optimized schedule task due date patches directly to PostgreSQL.
 */
export async function applyOptimizedSchedule(
  updates: TaskOptimizationUpdate[]
): Promise<{ success: boolean; updatedCount: number; error?: string }> {
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, updatedCount: 0, error: "Unauthorized. Please log in." };
  }

  try {
    let updatedCount = 0;
    const isUuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    for (const update of updates) {
      if (!update.id && !update.title) continue;

      const newDueAt = new Date(update.optimized_due_date);

      if (update.id && isUuidRegex.test(update.id)) {
        await db
          .update(tasks)
          .set({
            dueAt: newDueAt,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(tasks.id, update.id),
              eq(tasks.userId, user.id)
            )
          );
        updatedCount++;
      } else if (update.title) {
        await db
          .update(tasks)
          .set({
            dueAt: newDueAt,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(tasks.title, update.title),
              eq(tasks.userId, user.id)
            )
          );
        updatedCount++;
      }
    }

    revalidatePath("/plan/canvas");
    revalidatePath("/tasks");

    return { success: true, updatedCount };
  } catch (error: any) {
    console.error("applyOptimizedSchedule Error:", error);
    return { success: false, updatedCount: 0, error: error.message || "Failed to apply updates" };
  }
}

/** Helper: Builds CurrentState payload from real database entries for user */
async function buildCurrentStateForUser(userId: string): Promise<CurrentStatePayload> {
  const now = new Date();
  const sevenDaysAgoDate = subDays(now, 7);
  const sevenDaysAgoStr = format(sevenDaysAgoDate, "yyyy-MM-dd");

  const activeTasks = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        isNull(tasks.deletedAt),
        notInArray(tasks.status, ["done", "cancelled"])
      )
    );

  const taskPayloadItems: TaskPayloadItem[] = activeTasks.map((t) => ({
    id: t.id,
    title: t.title,
    estimated_hours: t.estimateMinutes ? roundToTwo(t.estimateMinutes / 60) : 1.5,
    due_date: t.dueAt ? format(new Date(t.dueAt), "yyyy-MM-dd") : null,
  }));

  const userHabits = await db
    .select()
    .from(habits)
    .where(
      and(
        eq(habits.userId, userId),
        isNull(habits.deletedAt),
        eq(habits.active, true)
      )
    );

  const habitLogsLast7Days = await db
    .select()
    .from(habitLogs)
    .where(
      and(
        eq(habitLogs.userId, userId),
        isNull(habitLogs.deletedAt),
        gte(habitLogs.loggedOn, sevenDaysAgoStr)
      )
    );

  const habitPayloadItems: HabitPayloadItem[] = userHabits.map((h) => {
    const logsForHabit = habitLogsLast7Days.filter((l) => l.habitId === h.id);
    const adherenceRate = Math.min(100, Math.round((logsForHabit.length / 7) * 100));
    return {
      name: h.title,
      adherence_rate: adherenceRate,
    };
  });

  const allMetrics = await db
    .select()
    .from(metricDefinitions)
    .where(
      and(
        eq(metricDefinitions.userId, userId),
        isNull(metricDefinitions.deletedAt)
      )
    );

  const sleepMetric = allMetrics.find((m) => /sleep/i.test(m.name));
  let avgSleepHours = 7.0;

  if (sleepMetric) {
    const sleepLogs = await db
      .select()
      .from(metricLogs)
      .where(
        and(
          eq(metricLogs.userId, userId),
          eq(metricLogs.metricId, sleepMetric.id),
          isNull(metricLogs.deletedAt),
          gte(metricLogs.loggedOn, sevenDaysAgoStr)
        )
      );

    if (sleepLogs.length > 0) {
      const totalSleep = sleepLogs.reduce((acc, l) => acc + Number(l.value || 0), 0);
      avgSleepHours = roundToTwo(totalSleep / sleepLogs.length);
    }
  }

  return {
    tasks: taskPayloadItems,
    habits: habitPayloadItems,
    health_metrics: {
      sleep_hours: avgSleepHours,
      sleep_baseline: 8.0,
      stress_level: 5.0,
    },
  };
}

function getSimulatorUrls(path: string): string[] {
  const baseEnv = process.env.SIMULATOR_URL;
  const urls: string[] = [];

  if (baseEnv) {
    urls.push(baseEnv.endsWith(path) ? baseEnv : `${baseEnv.replace(/\/$/, "")}${path}`);
  }
  urls.push(`http://127.0.0.1:8080${path}`);
  urls.push(`http://127.0.0.1:8000${path}`);

  return urls;
}

function roundToTwo(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}
