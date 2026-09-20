import { db } from "../src/server/db";
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
} from "../src/server/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

async function seed() {
  console.log("🌱 Starting Fast Bulk Database Seeder for PIW Workspace...");

  let allUsers = await db.select().from(users);

  if (allUsers.length === 0) {
    console.log("No users found. Creating demo user...");
    const userId = randomUUID();
    await db.insert(users).values({
      id: userId,
      email: "demo@piw.local",
      displayName: "PIW User",
      timezone: "UTC",
    });

    await db.insert(userSettings).values({
      userId: userId,
      assistantName: "Copilot",
      personaTone: "warm",
    });

    allUsers = await db.select().from(users);
  }

  console.log(`Seeding data for ${allUsers.length} user(s)...`);

  const now = new Date();

  for (const user of allUsers) {
    const userId = user.id;
    console.log(`Processing user ID: ${userId} (${user.email || "no-email"})...`);

    // 1. Seed Tasks & Nodes
    const existingTasks = await db.select().from(tasks).where(eq(tasks.userId, userId));
    if (existingTasks.length === 0) {
      console.log("Bulk Seeding Tasks & Nodes...");

      const sampleTasks = [
        { title: "Build predictive simulation engine sidecar", notes: "FastAPI sidecar with fuzzy logic risk evaluator and timeline API.", status: "in_progress", priority: 3, estimateMinutes: 180, dueDays: 2, sortKey: "a0" },
        { title: "Implement Dark mode theme toggle & responsive layout", notes: "Ensure glassmorphism UI components render cleanly on dark theme.", status: "in_progress", priority: 2, estimateMinutes: 120, dueDays: 3, sortKey: "a1" },
        { title: "Review PR #42 for Search Engine optimization", notes: "Inspect openalex literature search plugin integration.", status: "inbox", priority: 1, estimateMinutes: 45, dueDays: 1, sortKey: "a2" },
        { title: "Refactor JWT Auth & Supabase SSR refresh tokens", notes: "Fix session cookie synchronization during background sync.", status: "next", priority: 2, estimateMinutes: 90, dueDays: 5, sortKey: "a3" },
        { title: "Design Dashboard Analytics & Habit Widgets", notes: "Add streak counters and weekly completion bar chart.", status: "next", priority: 2, estimateMinutes: 150, dueDays: 6, sortKey: "a4" },
        { title: "Write End-to-End Cypress Integration Tests", notes: "Test tasks creation, habit toggling, and note auto-save.", status: "inbox", priority: 1, estimateMinutes: 120, dueDays: 8, sortKey: "a5" },
        { title: "Configure Supabase SSR authentication", notes: "Completed setup for middleware cookie validation.", status: "done", priority: 2, estimateMinutes: 60, dueDays: -2, sortKey: "a6" },
        { title: "Set up Next.js 16 app router layout & sidebar", notes: "Completed navigation sidebar with icon routes.", status: "done", priority: 3, estimateMinutes: 150, dueDays: -4, sortKey: "a7" },
        { title: "Create Drizzle ORM database schema definitions", notes: "Defined polymorphic entity tables and relations.", status: "done", priority: 3, estimateMinutes: 120, dueDays: -5, sortKey: "a8" },
      ];

      const tasksToInsert = [];
      const nodesToInsert = [];

      for (const t of sampleTasks) {
        const taskId = randomUUID();
        const dueAt = new Date(now.getTime() + t.dueDays * 24 * 60 * 60 * 1000);
        tasksToInsert.push({
          id: taskId,
          userId: userId,
          title: t.title,
          notes: t.notes,
          status: t.status,
          priority: t.priority,
          estimateMinutes: t.estimateMinutes,
          dueAt: dueAt,
          sortKey: t.sortKey,
        });
        nodesToInsert.push({
          id: taskId,
          userId: userId,
          entityType: "task",
          title: t.title,
          snippet: t.notes,
        });
      }

      await db.insert(tasks).values(tasksToInsert).onConflictDoNothing();
      await db.insert(nodes).values(nodesToInsert).onConflictDoNothing();
      console.log(`Successfully seeded ${tasksToInsert.length} tasks!`);
    }

    // 2. Seed Habits & Habit Logs (Bulk)
    const existingHabits = await db.select().from(habits).where(eq(habits.userId, userId));
    if (existingHabits.length === 0) {
      console.log("Bulk Seeding Habits & 30-day Habit Logs...");

      const sampleHabits = [
        { title: "Morning Running / Exercise", cadence: "daily", targetCount: 1, unit: "session", colour: "#10b981" },
        { title: "30-Min Tech Reading", cadence: "daily", targetCount: 1, unit: "session", colour: "#3b82f6" },
        { title: "Hydration Goal (2.5L)", cadence: "daily", targetCount: 2, unit: "litres", colour: "#06b6d4" },
        { title: "Code Review & Refactoring", cadence: "daily", targetCount: 1, unit: "session", colour: "#8b5cf6" },
        { title: "Mindfulness Meditation", cadence: "daily", targetCount: 15, unit: "mins", colour: "#ec4899" },
      ];

      const habitLogsToInsert = [];

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
        }).onConflictDoNothing();

        for (let dayOffset = 30; dayOffset >= 0; dayOffset--) {
          const logDate = new Date(now.getTime() - dayOffset * 24 * 60 * 60 * 1000);
          const dateStr = logDate.toISOString().split("T")[0];

          if ((dayOffset + h.title.length) % 3 !== 0) {
            habitLogsToInsert.push({
              userId: userId,
              habitId: habitId,
              loggedOn: dateStr,
              value: String(h.targetCount),
              backfilled: dayOffset > 1,
            });
          }
        }
      }

      if (habitLogsToInsert.length > 0) {
        await db.insert(habitLogs).values(habitLogsToInsert).onConflictDoNothing();
      }
      console.log(`Successfully seeded ${sampleHabits.length} habits with ${habitLogsToInsert.length} historical logs!`);
    }

    // 3. Seed Health Metrics & Logs (Bulk)
    const existingMetrics = await db.select().from(metricDefinitions).where(eq(metricDefinitions.userId, userId));
    if (existingMetrics.length === 0) {
      console.log("Bulk Seeding Health Metrics & Logs...");

      const metricsToCreate = [
        { name: "Sleep Hours", unit: "hours", defaultVals: [7.0, 6.5, 8.0, 7.5, 6.0, 8.5] },
        { name: "Stress Level", unit: "1-10", defaultVals: [4, 6, 5, 7, 3, 5] },
        { name: "Daily Focus Minutes", unit: "mins", defaultVals: [240, 180, 300, 210, 150] },
      ];

      const metricLogsToInsert = [];

      for (const m of metricsToCreate) {
        const metricId = randomUUID();
        await db.insert(metricDefinitions).values({
          id: metricId,
          userId: userId,
          name: m.name,
          unit: m.unit,
        }).onConflictDoNothing();

        for (let dayOffset = 30; dayOffset >= 0; dayOffset--) {
          const logDate = new Date(now.getTime() - dayOffset * 24 * 60 * 60 * 1000);
          const dateStr = logDate.toISOString().split("T")[0];
          const val = m.defaultVals[dayOffset % m.defaultVals.length];

          metricLogsToInsert.push({
            userId: userId,
            metricId: metricId,
            loggedOn: dateStr,
            value: String(val),
          });
        }
      }

      if (metricLogsToInsert.length > 0) {
        await db.insert(metricLogs).values(metricLogsToInsert).onConflictDoNothing();
      }
      console.log(`Successfully seeded ${metricsToCreate.length} metrics with ${metricLogsToInsert.length} logs!`);
    }

    // 4. Seed Goals (Bulk)
    const existingGoals = await db.select().from(goals).where(eq(goals.userId, userId));
    if (existingGoals.length === 0) {
      console.log("Bulk Seeding Strategic Goals...");

      const sampleGoals = [
        { title: "Master AI Agentic Engineering & Full-Stack Architecture", description: "Build robust, context-aware AI copilots, fuzzy prediction models, and scalable Next.js 16 applications.", lifeArea: "Career", status: "active", targetValue: "100", currentValue: "45", unit: "percent" },
        { title: "Complete 10k Marathon Preparation", description: "Maintain consistent running cadence, endurance building, and health metric tracking.", lifeArea: "Health", status: "active", targetValue: "10", currentValue: "6.5", unit: "km" },
        { title: "Read 12 Technical & Systems Design Books", description: "Deep dive into distributed systems, database design, and machine learning fundamentals.", lifeArea: "Growth", status: "active", targetValue: "12", currentValue: "4", unit: "books" },
      ];

      const goalsToInsert = [];
      const goalNodesToInsert = [];

      for (const g of sampleGoals) {
        const goalId = randomUUID();
        goalsToInsert.push({
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
        goalNodesToInsert.push({
          id: goalId,
          userId: userId,
          entityType: "goal",
          title: g.title,
          snippet: g.description,
        });
      }

      await db.insert(goals).values(goalsToInsert).onConflictDoNothing();
      await db.insert(nodes).values(goalNodesToInsert).onConflictDoNothing();
      console.log(`Successfully seeded ${goalsToInsert.length} goals!`);
    }

    // 5. Seed Notes (Bulk)
    const existingNotes = await db.select().from(notes).where(eq(notes.userId, userId));
    if (existingNotes.length === 0) {
      console.log("Bulk Seeding Notes...");

      const sampleNotes = [
        { title: "Polymorphic Entity Graph Architecture Blueprint", content: "# Entity Graph System\n\nAll tasks, goals, notes, and milestones are unified under the `nodes` relational index." },
        { title: "Fuzzy Logic Burnout Predictor Engine Notes", content: "# Predictive Simulator\n\nUses Scikit-Fuzzy logic with 3 antecedents to calculate burnout risk output (0-100%)." },
      ];

      const notesToInsert = [];
      const noteNodesToInsert = [];

      for (const n of sampleNotes) {
        const noteId = randomUUID();
        notesToInsert.push({
          id: noteId,
          userId: userId,
          title: n.title,
          content: n.content,
        });
        noteNodesToInsert.push({
          id: noteId,
          userId: userId,
          entityType: "note",
          title: n.title,
          snippet: n.content.slice(0, 100),
        });
      }

      await db.insert(notes).values(notesToInsert).onConflictDoNothing();
      await db.insert(nodes).values(noteNodesToInsert).onConflictDoNothing();
      console.log(`Successfully seeded ${notesToInsert.length} notes!`);
    }
  }

  console.log("🎉 Fast bulk database seeding completed successfully!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Database seeding failed:", err);
  process.exit(1);
});
