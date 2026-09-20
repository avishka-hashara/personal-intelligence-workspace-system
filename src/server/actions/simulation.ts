"use server";

import { db } from "@/server/db";
import { tasks, habits, habitLogs, metricDefinitions, metricLogs } from "@/server/db/schema";
import { eq, and, isNull, notInArray, gte } from "drizzle-orm";
import { getCurrentUser } from "@/utils/supabase/server";
import { subDays, format } from "date-fns";

export interface TaskPayloadItem {
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
    const userId = user.id;
    const now = new Date();
    const sevenDaysAgoDate = subDays(now, 7);
    const sevenDaysAgoStr = format(sevenDaysAgoDate, "yyyy-MM-dd");

    // 1. Query Active Tasks
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
      title: t.title,
      estimated_hours: t.estimateMinutes ? roundToTwo(t.estimateMinutes / 60) : 1.5,
      due_date: t.dueAt ? format(new Date(t.dueAt), "yyyy-MM-dd") : null,
    }));

    // 2. Query Habits and 7-day Habit Logs
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

    // 3. Query Health Metric Logs for Sleep (last 7 days)
    const allMetrics = await db
      .select()
      .from(metricDefinitions)
      .where(
        and(
          eq(metricDefinitions.userId, userId),
          isNull(metricDefinitions.deletedAt)
        )
      );

    const sleepMetric = allMetrics.find((m) =>
      /sleep/i.test(m.name)
    );

    let avgSleepHours = 7.0; // Default baseline if no sleep logs found

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

    // Construct Payload
    const currentState: CurrentStatePayload = {
      tasks: taskPayloadItems,
      habits: habitPayloadItems,
      health_metrics: {
        sleep_hours: avgSleepHours,
        sleep_baseline: 8.0,
        stress_level: 5.0,
      },
    };

    // 4. Send Request to Python FastAPI Sidecar Engine
    const simulatorUrls = [
      process.env.SIMULATOR_URL,
      "http://127.0.0.1:8080/simulate/timeline",
      "http://127.0.0.1:8000/simulate/timeline",
    ].filter(Boolean) as string[];

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

function roundToTwo(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}
