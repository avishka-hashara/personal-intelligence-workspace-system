import { streamText, convertToModelMessages, tool, isStepCount } from "ai";
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
import { eq, and, isNull, desc, asc, ilike, sql, isNotNull, or } from "drizzle-orm";
import { format } from "date-fns";
import { z } from "zod";
import * as chrono from "chrono-node";
import { generateKeyBetween } from "fractional-indexing";
import { revalidatePath } from "next/cache";
import { embedText } from "@/lib/embeddings";
import {
  buildSystemPrompt,
  detectAssistantName,
  detectUserName,
  trimConversationHistory,
} from "@/lib/persona";
import {
  getPersonaSettings,
  updatePersonaSettings,
} from "@/server/services/settingsService";
import { maybeTriggerRollingMemory } from "@/server/services/memoryService";

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

    const body = await req.json();
    const messages = body.messages;
    const rawPageContext = body.pageContext;

    // Validate ephemeral page context (never trust client payload directly)
    let validatedPageContext: { type: "Note" | "Goal" | "Course"; id: string; title: string; data?: string } | null = null;
    if (
      rawPageContext &&
      typeof rawPageContext === "object" &&
      (rawPageContext.type === "Note" || rawPageContext.type === "Goal" || rawPageContext.type === "Course") &&
      typeof rawPageContext.id === "string" &&
      rawPageContext.id.trim().length > 0
    ) {
      const cleanTitle = String(rawPageContext.title || "Untitled").trim();
      let cleanData: string | undefined = undefined;
      if (rawPageContext.data !== undefined && rawPageContext.data !== null) {
        const rawDataStr = String(rawPageContext.data);
        cleanData = rawDataStr.length > 2000 ? rawDataStr.slice(0, 2000) + "\n\n[...truncated]" : rawDataStr;
      }

      validatedPageContext = {
        type: rawPageContext.type,
        id: rawPageContext.id.trim(),
        title: cleanTitle,
        data: cleanData,
      };
    }

    // 1. Fetch persona settings for user
    const personaSettings = await getPersonaSettings(user.id);
    let currentAssistantName = personaSettings.assistantName || "Copilot";
    let currentUserName = personaSettings.userName;

    // 2. Real-time Naming Flow: detect assistant and user names from latest message
    const latestUserMessage = [...(messages || [])].reverse().find((m: any) => m.role === "user");
    const latestUserText = typeof latestUserMessage?.content === "string"
      ? latestUserMessage.content
      : Array.isArray(latestUserMessage?.parts)
      ? latestUserMessage.parts.map((p: any) => (p.type === "text" ? p.text : "")).join("")
      : "";

    const detectedAssistantName = detectAssistantName(latestUserText);
    if (detectedAssistantName && detectedAssistantName !== currentAssistantName) {
      currentAssistantName = detectedAssistantName;
      await updatePersonaSettings(user.id, { assistantName: detectedAssistantName });
      console.log(`[route] Saved assistant name "${detectedAssistantName}" for user ${user.id}`);
    }

    const detectedUserName = detectUserName(latestUserText);
    if (detectedUserName && detectedUserName !== currentUserName) {
      currentUserName = detectedUserName;
      await updatePersonaSettings(user.id, { userName: detectedUserName });
      console.log(`[route] Saved user name "${detectedUserName}" for user ${user.id}`);
    }

    // 3. Trim conversation history (last 12 turns max within token budget)
    const trimmedRawMessages = trimConversationHistory(messages, 12, 3500);

    // Normalize messages to ensure parts array exists for convertToModelMessages
    const normalizedMessages = (trimmedRawMessages || []).map((m: any) => {
      if (!Array.isArray(m.parts) || m.parts.length === 0) {
        const textContent = typeof m.content === "string" ? m.content : "";
        return {
          role: m.role || "user",
          parts: [{ type: "text" as const, text: textContent }],
        };
      }
      return m;
    });

    const modelMessages = await convertToModelMessages(normalizedMessages as any);

    // 4. Trigger rolling memory in background if turn count reaches checkpoint
    maybeTriggerRollingMemory(user.id, personaSettings.memorySummary, messages);

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

    const workspaceSnapshot = `=== LIVE WORKSPACE DATA ===
=== LIVE TASKS SNAPSHOT (${userTasks.length} total: ${pendingTasks.length} pending, ${completedTasks.length} completed) ===
PENDING TASKS:
${
  pendingTasks.length > 0
    ? pendingTasks
        .map(
          (t) =>
            `- [PENDING] [ID: ${t.id}] "${t.title}" (Priority: P${t.priority})${
              t.dueAt ? ` [Due: ${format(new Date(t.dueAt), "yyyy-MM-dd HH:mm")}]` : " [No due date]"
            }${t.notes ? ` (Notes: ${t.notes})` : ""}${
              t.subtasks.length > 0
                ? `\n  Subtasks: ${t.subtasks.map((s: any) => `"${s.title}" (${s.status}) [ID: ${s.id}]`).join(", ")}`
                : ""
            }`
        )
        .join("\n")
    : "No pending tasks."
}

COMPLETED TASKS:
${
  completedTasks.length > 0
    ? completedTasks.map((t) => `- [COMPLETED] [ID: ${t.id}] "${t.title}"`).join("\n")
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
   - Use 'completeTask' to mark an existing task as completed (done) when the user mentions finishing, checking off, completing, or marking a task as done (e.g. "mark 'submit report' as done", "completed database schema", "done with task 1"). Pass the taskId if available or the task title.
   - Use 'searchKnowledge' to search the user's notes, goals, and courses by meaning rather than exact wording whenever they refer to past information or topics not in the snapshot. Weave what you find directly and naturally into your answer without announcing that you searched.`;

    const systemPrompt = buildSystemPrompt({
      assistantName: currentAssistantName,
      userName: currentUserName,
      localTime: currentDateStr,
      memorySummary: personaSettings.memorySummary,
      pageContext: validatedPageContext,
      workspaceSnapshot,
    });

    const selectedModel = process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash";

    const result = streamText({
      model: openrouter.chat(selectedModel),
      temperature: 0.85,
      maxOutputTokens: 1000,
      messages: modelMessages,
      system: systemPrompt,
      tools: {
        createTask: tool({
          description: "Create a new actionable task for the user.",
          inputSchema: z.object({
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
          execute: async ({
            title,
            dueAt,
            dueDate,
            priority,
          }: {
            title?: string;
            dueAt?: string | Date;
            dueDate?: string | Date;
            priority?: number | string;
          }) => {
            let rawTitle = title;
            if (!rawTitle || typeof rawTitle !== "string" || !rawTitle.trim()) {
              const lastMsg = messages[messages.length - 1]?.content || "";
              const lastMsgText = typeof lastMsg === "string" ? lastMsg : "";
              rawTitle = lastMsgText.replace(/^[*\s]*remind\s+me\s+to\s+/i, "").replace(/^[*\s]*create\s+task\s+/i, "").replace(/[*"]/g, "").trim() || "New Task";
            }
            const dueAtInput = dueAt || dueDate;
            const priorityInput = priority;

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

        completeTask: tool({
          description: "Mark an existing task as completed (done).",
          inputSchema: z.object({
            taskId: z.string().optional().describe("The UUID of the task to mark as done"),
            title: z.string().optional().describe("The title or keywords of the task to mark as done"),
          }),
          execute: async ({ taskId, title }: { taskId?: string; title?: string }) => {
            console.log("[completeTask] Executing with args:", { taskId, title });
            try {
              // 1. Fetch all user's tasks
              const allUserTasks = await db
                .select()
                .from(tasks)
                .where(and(eq(tasks.userId, user.id), isNull(tasks.deletedAt)))
                .orderBy(asc(tasks.status), asc(tasks.createdAt));

              let targetTask: any = null;

              // 1. Try exact UUID match
              if (taskId) {
                targetTask = allUserTasks.find((t) => t.id === taskId);
              }

              // 2. Try match by title/keywords
              if (!targetTask && title) {
                const cleanQuery = title.toLowerCase().trim();

                // 2a. Direct exact or substring match
                targetTask = allUserTasks.find(
                  (t) =>
                    t.title.toLowerCase() === cleanQuery ||
                    t.title.toLowerCase().includes(cleanQuery) ||
                    cleanQuery.includes(t.title.toLowerCase())
                );

                // 2b. Word overlap fuzzy match
                if (!targetTask) {
                  const stopWords = new Set([
                    "the",
                    "a",
                    "an",
                    "to",
                    "my",
                    "task",
                    "please",
                    "done",
                    "complete",
                    "completed",
                    "finish",
                    "finished",
                  ]);
                  const queryWords = cleanQuery
                    .replace(/[^\w\s]/g, "")
                    .split(/\s+/)
                    .filter((w: string) => w.length > 1 && !stopWords.has(w));

                  if (queryWords.length > 0) {
                    let bestScore = 0;
                    let bestTask: any = null;

                    for (const t of allUserTasks) {
                      const taskTitleLower = t.title.toLowerCase();
                      let score = 0;
                      for (const qw of queryWords) {
                        if (taskTitleLower.includes(qw)) {
                          score += 1;
                        }
                      }
                      // Prefer pending tasks over already done tasks
                      if (t.status !== "done") {
                        score += 0.5;
                      }

                      if (score > bestScore) {
                        bestScore = score;
                        bestTask = t;
                      }
                    }

                    if (bestScore >= 1) {
                      targetTask = bestTask;
                    }
                  }
                }
              }

              // 3. Fallback: if only 1 pending task exists and user requested completing a task
              if (!targetTask) {
                const pending = allUserTasks.filter((t) => t.status !== "done");
                if (pending.length === 1) {
                  targetTask = pending[0];
                }
              }

              if (!targetTask) {
                return {
                  success: false,
                  error: `Could not find any task matching "${title || taskId || ""}".`,
                };
              }

              const [updatedTask] = await db
                .update(tasks)
                .set({ status: "done", updatedAt: new Date() })
                .where(and(eq(tasks.id, targetTask.id), eq(tasks.userId, user.id)))
                .returning();

              console.log("[completeTask] Successfully marked task as done in DB:", updatedTask);

              return {
                success: true,
                message: `Task "${updatedTask.title}" has been marked as completed.`,
                taskId: updatedTask.id,
                task: updatedTask,
              };
            } catch (err: any) {
              console.error("[completeTask] Error:", err);
              return { error: err?.message || "Failed to complete task" };
            }
          },
        }),

        searchKnowledge: tool({
          description:
            "Search the user's own notes, goals, and courses by meaning rather than exact wording. Use this whenever they refer to something they've written before, ask what they know about a topic, or ask a question you can't answer from the current page. Prefer calling it over guessing.",
          inputSchema: z.object({
            query: z
              .string()
              .describe("Search query to find relevant notes, goals, or courses by meaning"),
          }),
          execute: async ({ query }: { query: string }) => {
            console.log("[searchKnowledge] Executing search for query:", query);
            try {
              let vec: number[] | null = null;
              let isSemantic = true;

              try {
                vec = await embedText(query);
              } catch (embedErr) {
                console.warn(
                  "[searchKnowledge] Embedding generation failed, falling back to keyword search:",
                  embedErr
                );
                isSemantic = false;
              }

              if (vec && isSemantic) {
                const toVector = (v: number[]) => sql`${JSON.stringify(v)}::vector`;

                const vectorResults = await db
                  .select({
                    id: nodes.id,
                    title: nodes.title,
                    entityType: nodes.entityType,
                    snippet: nodes.snippet,
                    similarity: sql<number>`1 - (${nodes.embedding} <=> ${toVector(vec)})`,
                  })
                  .from(nodes)
                  .where(
                    and(
                      eq(nodes.userId, user.id), // MANDATORY
                      isNotNull(nodes.embedding),
                      sql`1 - (${nodes.embedding} <=> ${toVector(vec)}) > 0.25`
                    )
                  )
                  .orderBy(sql`${nodes.embedding} <=> ${toVector(vec)}`) // ASC
                  .limit(5);

                const formatted = vectorResults.map((r) => ({
                  id: r.id,
                  title: r.title || "Untitled",
                  entityType: r.entityType,
                  snippet: (r.snippet || r.title || "").trim().replace(/\s+/g, " ").slice(0, 300),
                  similarity: Number(r.similarity),
                }));

                return {
                  success: true,
                  query,
                  isSemantic: true,
                  count: formatted.length,
                  results: formatted,
                };
              }

              // Fallback keyword search
              const keywordResults = await db
                .select({
                  id: nodes.id,
                  title: nodes.title,
                  entityType: nodes.entityType,
                  snippet: nodes.snippet,
                })
                .from(nodes)
                .where(
                  and(
                    eq(nodes.userId, user.id),
                    or(
                      ilike(nodes.title, `%${query}%`),
                      ilike(nodes.snippet, `%${query}%`)
                    )
                  )
                )
                .limit(5);

              const formattedFallback = keywordResults.map((r) => ({
                id: r.id,
                title: r.title || "Untitled",
                entityType: r.entityType,
                snippet: (r.snippet || r.title || "").trim().replace(/\s+/g, " ").slice(0, 300),
                similarity: 1.0,
              }));

              return {
                success: true,
                query,
                isSemantic: false,
                fallback: true,
                count: formattedFallback.length,
                results: formattedFallback,
              };
            } catch (err: any) {
              console.error("[searchKnowledge] Error:", err);
              return { error: err?.message || "Failed to search knowledge graph" };
            }
          },
        }),
      },
      stopWhen: isStepCount(5),
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
