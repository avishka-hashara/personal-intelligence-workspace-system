import { streamText, convertToModelMessages } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { getCurrentUser } from "@/utils/supabase/server";
import { db } from "@/server/db";
import {
  tasks,
  goals,
  courses,
  exams,
  notes,
  habits,
} from "@/server/db/schema";
import { eq, and, isNull, desc, asc } from "drizzle-orm";
import { format } from "date-fns";

export const maxDuration = 30;

const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY || "",
  headers: {
    "HTTP-Referer": "http://localhost:3000",
    "X-Title": "Personal Intelligence Workspace",
  },
});

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    const { messages } = await req.json();

    const modelMessages = await convertToModelMessages(messages);

    // Context hydration: fetch live workspace data for this user
    let userTasks: any[] = [];
    let userGoals: any[] = [];
    let userCourses: any[] = [];
    let userExams: any[] = [];
    let userNotes: any[] = [];
    let userHabits: any[] = [];

    if (user) {
      const [
        fetchedTasks,
        fetchedGoals,
        fetchedCourses,
        fetchedExams,
        fetchedNotes,
        fetchedHabits,
      ] = await Promise.all([
        db
          .select({
            id: tasks.id,
            title: tasks.title,
            status: tasks.status,
            priority: tasks.priority,
            dueAt: tasks.dueAt,
            notes: tasks.notes,
            parentTaskId: tasks.parentTaskId,
          })
          .from(tasks)
          .where(and(eq(tasks.userId, user.id), isNull(tasks.deletedAt)))
          .orderBy(desc(tasks.priority), asc(tasks.dueAt)),

        db
          .select({
            id: goals.id,
            title: goals.title,
            lifeArea: goals.lifeArea,
            status: goals.status,
            targetDate: goals.targetDate,
            currentValue: goals.currentValue,
            targetValue: goals.targetValue,
            unit: goals.unit,
          })
          .from(goals)
          .where(and(eq(goals.userId, user.id), isNull(goals.deletedAt)))
          .limit(20),

        db
          .select({
            id: courses.id,
            code: courses.code,
            title: courses.title,
            term: courses.term,
            targetGrade: courses.targetGrade,
            active: courses.active,
          })
          .from(courses)
          .where(and(eq(courses.userId, user.id), isNull(courses.deletedAt)))
          .limit(20),

        db
          .select({
            id: exams.id,
            title: exams.title,
            startsAt: exams.startsAt,
            venue: exams.venue,
            weight: exams.weight,
            rampDays: exams.rampDays,
          })
          .from(exams)
          .where(and(eq(exams.userId, user.id), isNull(exams.deletedAt)))
          .orderBy(asc(exams.startsAt))
          .limit(10),

        db
          .select({
            id: notes.id,
            title: notes.title,
            content: notes.content,
            updatedAt: notes.updatedAt,
          })
          .from(notes)
          .where(and(eq(notes.userId, user.id), isNull(notes.deletedAt)))
          .orderBy(desc(notes.updatedAt))
          .limit(10),

        db
          .select({
            id: habits.id,
            title: habits.title,
            cadence: habits.cadence,
            targetCount: habits.targetCount,
            unit: habits.unit,
            active: habits.active,
          })
          .from(habits)
          .where(and(eq(habits.userId, user.id), isNull(habits.deletedAt)))
          .limit(15),
      ]);

      // Only include top-level tasks and nest valid subtasks under them
      const topLevelTasks = fetchedTasks.filter((t) => !t.parentTaskId);
      const subtaskMap = new Map<string, any[]>();
      for (const t of fetchedTasks) {
        if (t.parentTaskId) {
          const list = subtaskMap.get(t.parentTaskId) || [];
          list.push(t);
          subtaskMap.set(t.parentTaskId, list);
        }
      }

      userTasks = topLevelTasks.map((t) => ({
        ...t,
        subtasks: subtaskMap.get(t.id) || [],
      }));

      userGoals = fetchedGoals;
      userCourses = fetchedCourses;
      userExams = fetchedExams;
      userNotes = fetchedNotes;
      userHabits = fetchedHabits;
    }

    const now = new Date();
    const currentDateStr = format(now, "EEEE, MMMM d, yyyy 'at' h:mm a");

    const pendingTasks = userTasks.filter((t) => t.status !== "done");
    const completedTasks = userTasks.filter((t) => t.status === "done");

    const systemPrompt = `You are the intelligent Academic and Productivity Copilot embedded directly inside the user's Personal Intelligence Workspace (PIW).
You have real-time access to the user's live workspace data. ALWAYS inspect and reference this real data to give direct, actionable, and accurate answers.

=== CURRENT SYSTEM TIME ===
${currentDateStr}

=== LIVE TASKS SNAPSHOT (${userTasks.length} total: ${pendingTasks.length} pending, ${completedTasks.length} completed) ===
PENDING TASKS:
${
  pendingTasks.length > 0
    ? pendingTasks
        .map(
          (t) =>
            `- [PENDING] "${t.title}" (Priority: P${t.priority})${
              t.dueAt ? ` [Due: ${format(new Date(t.dueAt), "yyyy-MM-dd HH:mm")}]` : " [No due date]"
            }${t.notes ? ` (Notes: ${t.notes})` : ""}${
              t.subtasks.length > 0
                ? `\n  Subtasks: ${t.subtasks.map((s: any) => `"${s.title}" (${s.status})`).join(", ")}`
                : ""
            }`
        )
        .join("\n")
    : "No pending tasks."
}

COMPLETED TASKS:
${
  completedTasks.length > 0
    ? completedTasks.map((t) => `- [COMPLETED] "${t.title}"`).join("\n")
    : "No completed tasks."
}

=== LIVE GOALS (${userGoals.length} total) ===
${
  userGoals.length > 0
    ? userGoals
        .map(
          (g) =>
            `- [${g.status.toUpperCase()}] "${g.title}" (Life Area: ${g.lifeArea || "General"}, Progress: ${g.currentValue ?? 0}/${g.targetValue ?? "N/A"} ${g.unit || ""})`
        )
        .join("\n")
    : "No goals currently recorded."
}

=== LIVE COURSES (${userCourses.length} total) ===
${
  userCourses.length > 0
    ? userCourses
        .map(
          (c) =>
            `- [${c.code}] "${c.title}" (Term: ${c.term || "N/A"}, Target Grade: ${c.targetGrade || "N/A"}, Status: ${c.active ? "Active" : "Archived"})`
        )
        .join("\n")
    : "No courses recorded."
}

=== UPCOMING EXAMS (${userExams.length} total) ===
${
  userExams.length > 0
    ? userExams
        .map(
          (e) =>
            `- "${e.title}" on ${
              e.startsAt ? format(new Date(e.startsAt), "yyyy-MM-dd HH:mm") : "TBD"
            } (Weight: ${e.weight ? `${e.weight}%` : "N/A"}, Ramp schedule: ${e.rampDays || 14} days, Venue: ${e.venue || "N/A"})`
        )
        .join("\n")
    : "No upcoming exams recorded."
}

=== RECENT NOTES (${userNotes.length} total) ===
${
  userNotes.length > 0
    ? userNotes
        .map(
          (n) =>
            `- "${n.title}": ${
              n.content ? n.content.slice(0, 300).replace(/\n/g, " ") : "Empty note"
            }`
        )
        .join("\n")
    : "No notes recorded."
}

=== ACTIVE HABITS (${userHabits.length} total) ===
${
  userHabits.length > 0
    ? userHabits
        .map(
          (h) =>
            `- "${h.title}" (${h.cadence}, Target: ${h.targetCount} ${h.unit || "times"}, Active: ${h.active})`
        )
        .join("\n")
    : "No habits recorded."
}

=== INSTRUCTIONS FOR COPILOT ===
1. Only reference and list the EXACT items present in the live snapshot above. Do NOT invent, assume, or hallucinate any other tasks or exams.
2. If there is only 1 pending task (e.g. "submit report (URGENT)"), report only that 1 task and do not list non-existent tasks.
3. Be concise, direct, helpful, and organized using markdown formatting.`;

    const result = streamText({
      model: openrouter.chat("google/gemini-2.5-flash"),
      messages: modelMessages,
      maxOutputTokens: 2000,
      system: systemPrompt,
    });

    return result.toUIMessageStreamResponse();
  } catch (error: any) {
    console.error("Chat API error:", error);
    return new Response(
      JSON.stringify({
        error: error?.message || "An error occurred during chat processing",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
