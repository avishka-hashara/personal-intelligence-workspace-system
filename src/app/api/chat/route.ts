import { streamText, convertToModelMessages, tool } from "ai";
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
  nodes,
} from "@/server/db/schema";
import { eq, and, isNull, desc, asc, ilike } from "drizzle-orm";
import { format } from "date-fns";
import { z } from "zod";
import * as chrono from "chrono-node";
import { generateKeyBetween } from "fractional-indexing";
import { revalidatePath } from "next/cache";

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
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { messages } = await req.json();
    const modelMessages = await convertToModelMessages(messages);

    // Context hydration: fetch live workspace data for this user
    let userTasks: any[] = [];
    let userGoals: any[] = [];
    let userCourses: any[] = [];
    let userExams: any[] = [];
    let userNotes: any[] = [];
    let userHabits: any[] = [];

    const [
      fetchedTasks,
      fetchedGoals,
      fetchedCourses,
      fetchedExams,
      fetchedNotes,
      fetchedHabits,
    ] = await Promise.all([
      db
        .select()
        .from(tasks)
        .where(eq(tasks.userId, user.id))
        .orderBy(asc(tasks.sortKey), desc(tasks.createdAt))
        .catch((err) => {
          console.error("Error fetching tasks for chat context:", err);
          return [];
        }),

      db
        .select()
        .from(goals)
        .where(eq(goals.userId, user.id))
        .limit(20)
        .catch((err) => {
          console.error("Error fetching goals for chat context:", err);
          return [];
        }),

      db
        .select()
        .from(courses)
        .where(eq(courses.userId, user.id))
        .limit(20)
        .catch((err) => {
          console.error("Error fetching courses for chat context:", err);
          return [];
        }),

      db
        .select()
        .from(exams)
        .where(eq(exams.userId, user.id))
        .orderBy(asc(exams.startsAt))
        .limit(10)
        .catch((err) => {
          console.error("Error fetching exams for chat context:", err);
          return [];
        }),

      db
        .select()
        .from(notes)
        .where(eq(notes.userId, user.id))
        .orderBy(desc(notes.updatedAt))
        .limit(10)
        .catch((err) => {
          console.error("Error fetching notes for chat context:", err);
          return [];
        }),

      db
        .select()
        .from(habits)
        .where(eq(habits.userId, user.id))
        .limit(15)
        .catch((err) => {
          console.error("Error fetching habits for chat context:", err);
          return [];
        }),
    ]);

    // Filter out deleted tasks if applicable and order by priority desc
    const activeTasks = fetchedTasks
      .filter((t: any) => !t.deletedAt)
      .sort((a: any, b: any) => (b.priority ?? 0) - (a.priority ?? 0));

    // Only include top-level tasks and nest valid subtasks under them
    const topLevelTasks = activeTasks.filter((t: any) => !t.parentTaskId);
    const subtaskMap = new Map<string, any[]>();
    for (const t of activeTasks) {
      if (t.parentTaskId) {
        const list = subtaskMap.get(t.parentTaskId) || [];
        list.push(t);
        subtaskMap.set(t.parentTaskId, list);
      }
    }

    userTasks = topLevelTasks.map((t: any) => ({
      ...t,
      subtasks: subtaskMap.get(t.id) || [],
    }));

    userGoals = fetchedGoals.filter((g: any) => !g.deletedAt);
    userCourses = fetchedCourses.filter((c: any) => !c.deletedAt);
    userExams = fetchedExams.filter((e: any) => !e.deletedAt);
    userNotes = fetchedNotes.filter((n: any) => !n.deletedAt);
    userHabits = fetchedHabits.filter((h: any) => !h.deletedAt);

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
3. Be concise, direct, helpful, and organized using markdown formatting.
4. You have access to tools:
   - Use 'createTask' to create a new actionable task when the user requests adding, scheduling, or reminding them of a task. When the user says "remind me to..." or "create task...", IMMEDIATELY call the createTask tool with the extracted title, due date, and priority. Do NOT ask for confirmation first.
   - Use 'searchKnowledge' to search the knowledge graph (notes, courses, goals, tasks) for context when the user asks about specific topics or information not already fully captured in the snapshot above.`;

    const result = streamText({
      model: openrouter.chat("google/gemini-2.5-flash"),
      providerOptions: {
        openai: {
          maxCompletionTokens: 1500,
        },
      },
      messages: modelMessages,
      system: systemPrompt,
      tools: {
        createTask: tool({
          description: "Create a new actionable task for the user.",
          parameters: z.object({
            title: z.string().optional().describe("The task title or description, e.g. 'Finish database schema'"),
            dueAt: z
              .union([z.string(), z.date()])
              .optional()
              .describe("Due date string (ISO date or natural language date like 'tomorrow', 'tomorrow at 2pm')"),
            dueDate: z
              .union([z.string(), z.date()])
              .optional()
              .describe("Alternative field for due date"),
            priority: z
              .union([z.number(), z.string()])
              .optional()
              .describe("Task priority: 0-3 (where 3 is high/urgent) or words like 'high', 'urgent', 'medium', 'low'"),
          }),
          execute: async (rawArgs: any) => {
            let rawTitle = rawArgs?.title;
            if (!rawTitle || typeof rawTitle !== "string" || !rawTitle.trim()) {
              const lastMsg = messages[messages.length - 1]?.content || "";
              const lastMsgText = typeof lastMsg === "string" ? lastMsg : "";
              rawTitle = lastMsgText.replace(/^[*\s]*remind\s+me\s+to\s+/i, "").replace(/^[*\s]*create\s+task\s+/i, "").replace(/[*"]/g, "").trim() || "New Task";
            }
            const dueAtInput = rawArgs?.dueAt || rawArgs?.dueDate;
            const priorityInput = rawArgs?.priority;

            console.log("[createTask] Executing with args:", { rawTitle, dueAtInput, priorityInput });

            try {
              let parsedDueAt: Date | null = null;
              if (dueAtInput) {
                if (dueAtInput instanceof Date) {
                  parsedDueAt = dueAtInput;
                } else if (typeof dueAtInput === "string") {
                  const chronoDate = chrono.parseDate(dueAtInput);
                  if (chronoDate) {
                    parsedDueAt = chronoDate;
                  } else {
                    const d = new Date(dueAtInput);
                    if (!isNaN(d.getTime())) {
                      parsedDueAt = d;
                    }
                  }
                }
              }

              // Also check if title has natural language date that wasn't extracted
              let cleanTitle = rawTitle.trim();
              if (!parsedDueAt) {
                const chronoParsed = chrono.parse(cleanTitle);
                if (chronoParsed.length > 0) {
                  parsedDueAt = chronoParsed[0].start.date();
                  const cleaned = cleanTitle.replace(chronoParsed[0].text, "").replace(/\s+/g, " ").trim();
                  if (cleaned.length > 0) {
                    cleanTitle = cleaned;
                  }
                }
              }

              // Parse priority (0-3)
              let parsedPriority = 0;
              if (typeof priorityInput === "number") {
                parsedPriority = Math.max(0, Math.min(3, Math.round(priorityInput)));
              } else if (typeof priorityInput === "string") {
                const lower = priorityInput.toLowerCase();
                if (lower.includes("high") || lower.includes("urgent") || lower.includes("p3") || lower.includes("p1")) {
                  parsedPriority = 3;
                } else if (lower.includes("med") || lower.includes("p2")) {
                  parsedPriority = 2;
                } else if (lower.includes("low")) {
                  parsedPriority = 1;
                } else {
                  const n = parseInt(priorityInput, 10);
                  if (!isNaN(n)) {
                    parsedPriority = Math.max(0, Math.min(3, n));
                  }
                }
              }

              const [topTask] = await db
                .select({ sortKey: tasks.sortKey })
                .from(tasks)
                .where(eq(tasks.userId, user.id))
                .orderBy(asc(tasks.sortKey))
                .limit(1);

              const sortKey = generateKeyBetween(null, topTask?.sortKey ?? null);

              const [insertedTask] = await db
                .insert(tasks)
                .values({
                  userId: user.id,
                  title: cleanTitle,
                  status: "next",
                  dueAt: parsedDueAt,
                  priority: parsedPriority,
                  sortKey,
                })
                .returning();

              console.log("[createTask] Successfully inserted task in database:", insertedTask);

              return {
                success: true,
                message: `Task "${cleanTitle}" created successfully with priority P${parsedPriority}.`,
                taskId: insertedTask.id,
                task: insertedTask,
              };
            } catch (err: any) {
              console.error("[createTask] Tool createTask database error:", err);
              return { error: err?.message || "Failed to create task" };
            }
          },
        }),

        searchKnowledge: tool({
          description:
            "Search the user's knowledge graph (notes, courses, goals, tasks) for context.",
          parameters: z.object({
            query: z
              .string()
              .describe("Search query for knowledge graph nodes"),
          }),
          execute: async ({ query }) => {
            try {
              const matchedNodes = await db
                .select({
                  id: nodes.id,
                  title: nodes.title,
                  entityType: nodes.entityType,
                })
                .from(nodes)
                .where(
                  and(
                    eq(nodes.userId, user.id),
                    ilike(nodes.title, `%${query}%`)
                  )
                )
                .limit(5);

              return {
                success: true,
                query,
                results: matchedNodes.map((n) => ({
                  id: n.id,
                  title: n.title,
                  entityType: n.entityType,
                })),
                count: matchedNodes.length,
              };
            } catch (err: any) {
              console.error("Tool searchKnowledge error:", err);
              return { error: err?.message || "Failed to search knowledge graph" };
            }
          },
        }),
      },
      maxSteps: 5,
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
