import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { getCurrentUser } from "@/utils/supabase/server";
import { db } from "@/server/db";
import {
  syllabusItems,
  courses,
  nodes,
  notes,
  studySessions,
} from "@/server/db/schema";
import { eq, and, isNull, sql, isNotNull, inArray } from "drizzle-orm";
import { z } from "zod";
import { embedText } from "@/lib/embeddings";

export const maxDuration = 45;

const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY || "",
  headers: {
    "HTTP-Referer": "http://localhost:3000",
    "X-Title": "Personal Intelligence Workspace",
  },
});

const quizQuestionSchema = z.object({
  stem: z.string().describe("The active-recall question stem / prompt"),
  options: z.array(z.string()).min(2).max(6).describe("4 plausible multiple choice options"),
  answer_index: z.number().int().describe("0-based index of the correct answer in options array"),
  explanation: z.string().describe("Detailed explanation of why the correct option is right and others are incorrect"),
  source_chunk_id: z.string().describe("The exact ID of the context chunk supporting this question"),
});

const emitQuizSchema = z.object({
  questions: z.array(quizQuestionSchema).describe("List of generated multiple choice quiz questions"),
});

export type QuizQuestion = z.infer<typeof quizQuestionSchema>;

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
    const { syllabus_item_id, question_count = 5 } = body;

    if (!syllabus_item_id) {
      return new Response(
        JSON.stringify({ error: "syllabus_item_id is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const count = Math.min(Math.max(1, parseInt(String(question_count), 10) || 5), 10);

    // 1. Fetch Syllabus Item
    const [syllabusItem] = await db
      .select()
      .from(syllabusItems)
      .where(
        and(
          eq(syllabusItems.id, syllabus_item_id),
          eq(syllabusItems.userId, user.id),
          isNull(syllabusItems.deletedAt)
        )
      )
      .limit(1);

    if (!syllabusItem) {
      return new Response(
        JSON.stringify({ error: "Syllabus item not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. Fetch Course Details
    const [course] = await db
      .select()
      .from(courses)
      .where(
        and(
          eq(courses.id, syllabusItem.courseId),
          eq(courses.userId, user.id),
          isNull(courses.deletedAt)
        )
      )
      .limit(1);

    if (!course) {
      return new Response(
        JSON.stringify({ error: "Course not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // 3. Phase 2 Semantic Retrieval: Gather relevant context chunks
    const contextChunks: { id: string; title: string; type: string; content: string }[] = [];

    // Always add primary syllabus topic chunk as foundational anchor
    contextChunks.push({
      id: syllabusItem.id,
      title: syllabusItem.title,
      type: "syllabus_topic",
      content: `Topic: ${syllabusItem.title}\nCourse: ${course.title} (${course.code})\nCoverage Status: ${syllabusItem.coverage}\nConfidence: ${syllabusItem.confidence ?? 1}/5`,
    });

    // Vector Similarity Search using embeddings
    try {
      const searchPhrase = `${syllabusItem.title} ${course.title} ${course.code}`;
      const queryVec = await embedText(searchPhrase);

      if (queryVec && queryVec.length > 0) {
        const toVector = (v: number[]) => sql`${JSON.stringify(v)}::vector`;

        const similarNodes = await db
          .select({
            id: nodes.id,
            title: nodes.title,
            entityType: nodes.entityType,
            snippet: nodes.snippet,
            similarity: sql<number>`1 - (${nodes.embedding} <=> ${toVector(queryVec)})`,
          })
          .from(nodes)
          .where(
            and(
              eq(nodes.userId, user.id),
              isNotNull(nodes.embedding),
              sql`1 - (${nodes.embedding} <=> ${toVector(queryVec)}) > 0.20`
            )
          )
          .orderBy(sql`${nodes.embedding} <=> ${toVector(queryVec)}`)
          .limit(6);

        for (const sn of similarNodes) {
          if (sn.id !== syllabusItem.id && sn.snippet) {
            contextChunks.push({
              id: sn.id,
              title: sn.title || "Related Knowledge",
              type: sn.entityType,
              content: sn.snippet,
            });
          }
        }
      }
    } catch (embedErr) {
      console.warn("[/api/v1/ai/quiz] Embedding search fallback:", embedErr);
    }

    // Direct fetch of study session notes on this syllabus item
    const recentSessions = await db
      .select({
        id: studySessions.id,
        technique: studySessions.technique,
        notes: studySessions.notes,
        createdAt: studySessions.createdAt,
      })
      .from(studySessions)
      .where(
        and(
          eq(studySessions.syllabusItemId, syllabus_item_id),
          eq(studySessions.userId, user.id),
          isNotNull(studySessions.notes)
        )
      )
      .limit(3);

    for (const session of recentSessions) {
      if (session.notes && session.notes.trim().length > 0) {
        contextChunks.push({
          id: session.id,
          title: `Study Session Note (${session.technique || "General"})`,
          type: "study_session",
          content: session.notes,
        });
      }
    }

    // 4. AI Gateway Call (Claude Haiku 4.5, max_tokens: 1600, temperature: 0.5)
    const preferredModel =
      process.env.QUIZ_MODEL ||
      process.env.OPENROUTER_HAIKU_MODEL ||
      "anthropic/claude-haiku-4.5";

    const prompt = `You are AI-07b, an expert academic quiz generator and pedagogical evaluator.
Generate a high-yield, active-recall multiple choice quiz of exactly ${count} questions testing deep understanding of:
Topic: "${syllabusItem.title}"
Course: "${course.title} (${course.code})"

CONTEXT CHUNKS:
${JSON.stringify(contextChunks, null, 2)}

SPECIFICATIONS:
1. Generate exactly ${count} multiple choice questions.
2. For each question:
   - "stem": A clear, concise question testing concepts, application, core definitions, or critical distinctions.
   - "options": Exactly 4 distinct plausible answer choices.
   - "answer_index": The 0-based index (0, 1, 2, or 3) pointing to the single correct option.
   - "explanation": An instructive explanation explaining why the correct option is right and why distractors are wrong.
   - "source_chunk_id": The exact 'id' from the provided CONTEXT CHUNKS that supports or inspires this question (e.g. "${syllabusItem.id}").
3. Make distractors realistic and challenging to reinforce genuine mastery.`;

    let quizResult: z.infer<typeof emitQuizSchema>;

    try {
      const response = await generateObject({
        model: openrouter.chat(preferredModel),
        schema: emitQuizSchema,
        prompt,
        temperature: 0.5,
        providerOptions: {
          openai: {
            maxCompletionTokens: 1600,
          },
        },
      });
      quizResult = response.object;
    } catch (primaryErr: any) {
      console.warn(
        `[/api/v1/ai/quiz] Primary model ${preferredModel} failed (${primaryErr?.message}), switching to resilient fallback...`
      );
      const fallbackResponse = await generateObject({
        model: openrouter.chat("google/gemini-2.5-flash"),
        schema: emitQuizSchema,
        prompt,
        temperature: 0.5,
        providerOptions: {
          openai: {
            maxCompletionTokens: 1600,
          },
        },
      });
      quizResult = fallbackResponse.object;
    }

    return new Response(
      JSON.stringify({
        success: true,
        topic: syllabusItem.title,
        course: {
          id: course.id,
          code: course.code,
          title: course.title,
        },
        chunks: contextChunks.map((c) => ({ id: c.id, title: c.title, type: c.type })),
        questions: quizResult.questions,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[/api/v1/ai/quiz] Error generating quiz:", error);
    return new Response(
      JSON.stringify({
        error: error?.message || "Failed to generate AI quiz",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
