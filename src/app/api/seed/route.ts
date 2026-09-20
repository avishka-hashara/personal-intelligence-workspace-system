import { NextResponse } from "next/server";
import { db } from "@/server/db";
import {
  users,
  userSettings,
  tasks,
  habits,
  habitLogs,
  metricDefinitions,
  metricLogs,
  goals,
  notes,
  nodes,
} from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/utils/supabase/server";
import { randomUUID } from "crypto";

export async function GET() {
  try {
    const authUser = await getCurrentUser();
    let targetUsers = [];

    if (authUser) {
      targetUsers = [{ id: authUser.id, email: authUser.email }];
    } else {
      targetUsers = await db.select().from(users);
    }

    if (targetUsers.length === 0) {
      const demoId = randomUUID();
      await db.insert(users).values({
        id: demoId,
        email: "demo@piw.local",
        displayName: "Demo User",
      });
      await db.insert(userSettings).values({
        userId: demoId,
        assistantName: "Copilot",
      });
      targetUsers = [{ id: demoId, email: "demo@piw.local" }];
    }

    const now = new Date();
    let seededTaskCount = 0;
    let seededHabitCount = 0;
    let seededGoalCount = 0;

    for (const u of targetUsers) {
      const userId = u.id;

      // 1. Seed Tasks
      const existingTasks = await db.select().from(tasks).where(eq(tasks.userId, userId));
      if (existingTasks.length === 0) {
        const sampleTasks = [
          {
            title: "Build predictive simulation engine sidecar",
            notes: "FastAPI sidecar with fuzzy logic risk evaluator and timeline API.",
            status: "in_progress",
            priority: 3,
            estimateMinutes: 180,
            dueAt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
            sortKey: "a0",
          },
          {
            title: "Implement Dark mode theme toggle & responsive layout",
            notes: "Ensure glassmorphism UI components render cleanly on dark theme.",
            status: "in_progress",
            priority: 2,
            estimateMinutes: 120,
            dueAt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
            sortKey: "a1",
          },
          {
            title: "Review PR #42 for Search Engine optimization",
            notes: "Inspect openalex literature search plugin integration.",
            status: "inbox",
            priority: 1,
            estimateMinutes: 45,
            dueAt: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000),
            sortKey: "a2",
          },
          {
            title: "Refactor JWT Auth & Supabase SSR refresh tokens",
            notes: "Fix session cookie synchronization during background sync.",
            status: "next",
            priority: 2,
            estimateMinutes: 90,
            dueAt: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
            sortKey: "a3",
          },
          {
            title: "Design Dashboard Analytics & Habit Widgets",
            notes: "Add streak counters and weekly completion bar chart.",
            status: "next",
            priority: 2,
            estimateMinutes: 150,
            dueAt: new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000),
            sortKey: "a4",
          },
          {
            title: "Configure Supabase SSR authentication",
            notes: "Completed setup for middleware cookie validation.",
            status: "done",
            priority: 2,
            estimateMinutes: 60,
            dueAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
            sortKey: "a5",
          },
          {
            title: "Set up Next.js 16 app router layout & sidebar",
            notes: "Completed navigation sidebar with icon routes.",
            status: "done",
            priority: 3,
            estimateMinutes: 150,
            dueAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
            sortKey: "a6",
          },
        ];

        for (const t of sampleTasks) {
          const taskId = randomUUID();
          await db.insert(tasks).values({
            id: taskId,
            userId: userId,
            title: t.title,
            notes: t.notes,
            status: t.status,
            priority: t.priority,
            estimateMinutes: t.estimateMinutes,
            dueAt: t.dueAt,
            sortKey: t.sortKey,
          });

          await db.insert(nodes).values({
            id: taskId,
            userId: userId,
            entityType: "task",
            title: t.title,
            snippet: t.notes,
          });
          seededTaskCount++;
        }
      }

      // 2. Seed Habits
      const existingHabits = await db.select().from(habits).where(eq(habits.userId, userId));
      if (existingHabits.length === 0) {
        const sampleHabits = [
          { title: "Morning Running / Exercise", cadence: "daily", targetCount: 1, unit: "session", colour: "#10b981" },
          { title: "30-Min Tech Reading", cadence: "daily", targetCount: 1, unit: "session", colour: "#3b82f6" },
          { title: "Hydration Goal (2.5L)", cadence: "daily", targetCount: 2, unit: "litres", colour: "#06b6d4" },
          { title: "Code Review & Refactoring", cadence: "daily", targetCount: 1, unit: "session", colour: "#8b5cf6" },
          { title: "Mindfulness Meditation", cadence: "daily", targetCount: 15, unit: "mins", colour: "#ec4899" },
        ];

        for (const h of sampleHabits) {
          const habitId = randomUUID();
          await db.insert(habits).values({
            id: habitId,
            userId: userId,
            title: h.title,
            cadence: h.cadence,
            targetCount: h.targetCount,
            unit: h.unit,
            colour: h.colour,
            active: true,
          });

          // Generate 30 days of past habit logs
          for (let dayOffset = 30; dayOffset >= 0; dayOffset--) {
            const logDate = new Date(now.getTime() - dayOffset * 24 * 60 * 60 * 1000);
            const dateStr = logDate.toISOString().split("T")[0];

            if ((dayOffset + h.title.length) % 3 !== 0) {
              await db
                .insert(habitLogs)
                .values({
                  userId: userId,
                  habitId: habitId,
                  loggedOn: dateStr,
                  value: String(h.targetCount),
                  backfilled: dayOffset > 1,
                })
                .onConflictDoNothing();
            }
          }
          seededHabitCount++;
        }
      }

      // 3. Seed Health Metrics
      const existingMetrics = await db.select().from(metricDefinitions).where(eq(metricDefinitions.userId, userId));
      if (existingMetrics.length === 0) {
        const metricsToCreate = [
          { name: "Sleep Hours", unit: "hours", defaultVals: [7.0, 6.5, 8.0, 7.5, 6.0, 8.5] },
          { name: "Stress Level", unit: "1-10", defaultVals: [4, 6, 5, 7, 3, 5] },
          { name: "Daily Focus Minutes", unit: "mins", defaultVals: [240, 180, 300, 210, 150] },
        ];

        for (const m of metricsToCreate) {
          const metricId = randomUUID();
          await db.insert(metricDefinitions).values({
            id: metricId,
            userId: userId,
            name: m.name,
            unit: m.unit,
          });

          for (let dayOffset = 30; dayOffset >= 0; dayOffset--) {
            const logDate = new Date(now.getTime() - dayOffset * 24 * 60 * 60 * 1000);
            const dateStr = logDate.toISOString().split("T")[0];
            const val = m.defaultVals[dayOffset % m.defaultVals.length];

            await db.insert(metricLogs).values({
              userId: userId,
              metricId: metricId,
              loggedOn: dateStr,
              value: String(val),
            });
          }
        }
      }

      // 4. Seed Goals
      const existingGoals = await db.select().from(goals).where(eq(goals.userId, userId));
      if (existingGoals.length === 0) {
        const sampleGoals = [
          {
            title: "Master AI Agentic Engineering & Full-Stack Architecture",
            description: "Build robust, context-aware AI copilots, fuzzy prediction models, and scalable Next.js 16 applications.",
            lifeArea: "Career",
            status: "active",
            targetValue: "100",
            currentValue: "45",
            unit: "percent",
          },
          {
            title: "Complete 10k Marathon Preparation",
            description: "Maintain consistent running cadence, endurance building, and health metric tracking.",
            lifeArea: "Health",
            status: "active",
            targetValue: "10",
            currentValue: "6.5",
            unit: "km",
          },
        ];

        for (const g of sampleGoals) {
          const goalId = randomUUID();
          await db.insert(goals).values({
            id: goalId,
            userId: userId,
            title: g.title,
            description: g.description,
            lifeArea: g.lifeArea,
            status: g.status,
            targetValue: g.targetValue,
            currentValue: g.currentValue,
            unit: g.unit,
          });

          await db.insert(nodes).values({
            id: goalId,
            userId: userId,
            entityType: "goal",
            title: g.title,
            snippet: g.description,
          });
          seededGoalCount++;
        }
      }

      // 5. Seed Notes
      const existingNotes = await db.select().from(notes).where(eq(notes.userId, userId));
      if (existingNotes.length === 0) {
        const sampleNotes = [
          {
            title: "Polymorphic Entity Graph Architecture Blueprint",
            content: "# Entity Graph System\n\nAll tasks, goals, notes, and milestones are unified under the `nodes` relational index.",
          },
          {
            title: "Fuzzy Logic Burnout Predictor Engine Notes",
            content: "# Predictive Simulator\n\nUses Scikit-Fuzzy logic with 3 antecedents to calculate burnout risk output (0-100%).",
          },
        ];

        for (const n of sampleNotes) {
          const noteId = randomUUID();
          await db.insert(notes).values({
            id: noteId,
            userId: userId,
            title: n.title,
            content: n.content,
          });

          await db.insert(nodes).values({
            id: noteId,
            userId: userId,
            entityType: "note",
            title: n.title,
            snippet: n.content.slice(0, 100),
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Successfully seeded workspace database!",
      stats: {
        usersCount: targetUsers.length,
        seededTasks: seededTaskCount,
        seededHabits: seededHabitCount,
        seededGoals: seededGoalCount,
      },
    });
  } catch (error: any) {
    console.error("Seeding API error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to seed database" },
      { status: 500 }
    );
  }
}
