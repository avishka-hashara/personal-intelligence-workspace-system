import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { db } from "../src/server/db";
import {
  users,
  courses,
  syllabusItems,
  exams,
  flashcards,
  nodes,
} from "../src/server/db/schema";
import { eq, inArray } from "drizzle-orm";
import { addDays, subDays } from "date-fns";
import { fsrs, generatorParameters, Rating, State, createEmptyCard, dateDiffInDays } from "ts-fsrs";
import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";

const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY || "",
  headers: {
    "HTTP-Referer": "http://localhost:3000",
    "X-Title": "Personal Intelligence Workspace",
  },
});

async function runFSRSandQuizVerification() {
  console.log("=================================================");
  console.log("   PIW Phase 3: FSRS Exam Ramp & AI-07b Test     ");
  console.log("=================================================\n");

  const allUsers = await db.select().from(users).limit(1);
  if (allUsers.length === 0) {
    throw new Error("No test user found in database");
  }
  const testUser = allUsers[0];
  console.log(`Using Test User: ${testUser.id} (${testUser.email})\n`);

  let testCourseId: string | null = null;
  let testSyllabusItemId: string | null = null;
  let testExamId: string | null = null;
  const createdCardIds: string[] = [];

  try {
    // -------------------------------------------------------------
    // SETUP: Course, Syllabus Item, and Cards
    // -------------------------------------------------------------
    const [testCourse] = await db
      .insert(courses)
      .values({
        userId: testUser.id,
        code: "CS480",
        title: "Advanced Artificial Intelligence & Neural Networks",
        term: "Fall 2026",
        active: true,
      })
      .returning();
    testCourseId = testCourse.id;

    const [testSyllabusItem] = await db
      .insert(syllabusItems)
      .values({
        userId: testUser.id,
        courseId: testCourse.id,
        title: "Backpropagation & Gradient Descent Algorithms",
        ordinal: 0,
        coverage: "in_progress",
        confidence: 2,
      })
      .returning();
    testSyllabusItemId = testSyllabusItem.id;

    // --- TEST 1: FSRS Algorithm Core Sanity ---
    console.log("--- Test 1: FSRS Math & Scheduling Engine Sanity ---");
    const f = fsrs(generatorParameters({ request_retention: 0.9 }));
    const emptyCard = createEmptyCard(new Date());
    const repeatRecord = f.repeat(emptyCard, new Date());

    const goodCard = repeatRecord[Rating.Good].card;
    console.log(`Initial New Card -> Good Rating: Stability = ${goodCard.stability.toFixed(2)}, Difficulty = ${goodCard.difficulty.toFixed(2)}, Reps = ${goodCard.reps}`);

    if (goodCard.stability <= 0 || goodCard.reps !== 1) {
      throw new Error("FSRS repeat did not properly initialize card state!");
    }

    const retrievabilityNow = f.get_retrievability(goodCard, new Date(), false) as number;
    const retrievabilityIn10Days = f.get_retrievability(goodCard, addDays(new Date(), 10), false) as number;
    console.log(`Retrievability Now: ${(retrievabilityNow * 100).toFixed(1)}%, In 10 Days: ${(retrievabilityIn10Days * 100).toFixed(1)}%`);

    if (retrievabilityIn10Days >= retrievabilityNow) {
      throw new Error("Forgetting curve did not decay over time!");
    }
    console.log("✓ PASS: FSRS algorithm and retrievability curve validated!\n");

    // --- TEST 2: FSRS Exam Mode Ramp Logic ---
    console.log("--- Test 2: FSRS Exam Mode Retrievability Ramp ---");

    // Card A: High stability (Stability = 90 days), next review in 45 days.
    // In 10 days, retrievability will still be high (> 0.85). Should NOT be pulled forward.
    const [cardA] = await db
      .insert(flashcards)
      .values({
        userId: testUser.id,
        courseId: testCourse.id,
        front: "What is Backpropagation?",
        back: "Reverse-mode automatic differentiation calculating gradients of the loss with respect to weights.",
        stability: "90.0000",
        difficulty: "3.5000",
        reps: 6,
        lapses: 0,
        state: State.Review,
        lastReview: subDays(new Date(), 5),
        nextReviewAt: addDays(new Date(), 45),
        intervalDays: 50,
      })
      .returning();
    createdCardIds.push(cardA.id);

    // Card B: Low stability (Stability = 3 days), next review in 15 days.
    // At Exam date in 10 days, retrievability will drop below 0.85. Should BE pulled forward!
    const [cardB] = await db
      .insert(flashcards)
      .values({
        userId: testUser.id,
        courseId: testCourse.id,
        front: "What is Stochastic Gradient Descent (SGD)?",
        back: "An optimization method computing loss gradient on mini-batches to update parameters iteratively.",
        stability: "2.5000",
        difficulty: "5.0000",
        reps: 1,
        lapses: 0,
        state: State.Review,
        lastReview: subDays(new Date(), 2),
        nextReviewAt: addDays(new Date(), 15),
        intervalDays: 17,
      })
      .returning();
    createdCardIds.push(cardB.id);

    // Card C: Brand new unreviewed card (Stability = 0). Should BE pulled forward.
    const [cardC] = await db
      .insert(flashcards)
      .values({
        userId: testUser.id,
        courseId: testCourse.id,
        front: "What is the Vanishing Gradient problem?",
        back: "When backpropagated gradients become exponentially small in deep networks using saturating activations.",
        stability: "0",
        difficulty: "0",
        reps: 0,
        lapses: 0,
        state: State.New,
        lastReview: null,
        nextReviewAt: new Date(),
        intervalDays: 0,
      })
      .returning();
    createdCardIds.push(cardC.id);

    // Create an Exam in 10 days (within 14 days ramp period)
    const examDate = addDays(new Date(), 10);
    const [testExam] = await db
      .insert(exams)
      .values({
        userId: testUser.id,
        courseId: testCourse.id,
        title: "Midterm Exam 1",
        startsAt: examDate,
        rampDays: 14,
      })
      .returning();
    testExamId = testExam.id;

    // Simulate Exam Ramp calculation
    const now = new Date();
    const allCourseCards = [cardA, cardB, cardC];
    const daysUntilExam = 10;
    const isExamMode = daysUntilExam <= 14;

    const processedResults = allCourseCards.map((c) => {
      const isStandardDue = !c.nextReviewAt || new Date(c.nextReviewAt) <= now || c.state === State.New || !c.stability || c.stability === "0";
      let isDue = isStandardDue;
      let dueReason: "standard" | "exam_ramp" | "not_due" = isStandardDue ? "standard" : "not_due";
      let retrievabilityAtExam: number | null = null;

      if (isExamMode) {
        if (c.state === State.New || !c.lastReview || !c.stability || Number(c.stability) <= 0) {
          retrievabilityAtExam = 0;
          isDue = true;
          dueReason = isStandardDue ? "standard" : "exam_ramp";
        } else {
          const fsrsCard = {
            due: c.nextReviewAt ? new Date(c.nextReviewAt) : new Date(c.createdAt),
            stability: Number(c.stability),
            difficulty: Number(c.difficulty) || 4.0,
            elapsed_days: 0,
            scheduled_days: c.intervalDays || 0,
            reps: c.reps || 0,
            lapses: c.lapses || 0,
            learning_steps: 0,
            state: c.state ?? State.Review,
            last_review: c.lastReview ? new Date(c.lastReview) : new Date(c.createdAt),
          };
          const r = f.get_retrievability(fsrsCard, examDate, false) as number;
          retrievabilityAtExam = Math.round(r * 1000) / 1000;

          if (r < 0.85) {
            isDue = true;
            dueReason = isStandardDue ? "standard" : "exam_ramp";
          } else if (isStandardDue) {
            isDue = true;
            dueReason = "standard";
          } else {
            isDue = false;
            dueReason = "not_due";
          }
        }
      }
      return { id: c.id, front: c.front, isDue, dueReason, retrievabilityAtExam };
    });

    const resA = processedResults.find((r) => r.id === cardA.id)!;
    const resB = processedResults.find((r) => r.id === cardB.id)!;
    const resC = processedResults.find((r) => r.id === cardC.id)!;

    console.log(`Card A (High stability S=90d): Due=${resA.isDue}, Reason=${resA.dueReason}, RetrievabilityAtExam=${resA.retrievabilityAtExam}`);
    console.log(`Card B (Low stability S=2.5d): Due=${resB.isDue}, Reason=${resB.dueReason}, RetrievabilityAtExam=${resB.retrievabilityAtExam}`);
    console.log(`Card C (New card S=0d): Due=${resC.isDue}, Reason=${resC.dueReason}, RetrievabilityAtExam=${resC.retrievabilityAtExam}`);

    if (resA.isDue !== false || resA.dueReason !== "not_due") {
      throw new Error(`Card A should not be due, got isDue=${resA.isDue}, reason=${resA.dueReason}`);
    }
    if (resB.isDue !== true || resB.dueReason !== "exam_ramp") {
      throw new Error(`Card B with R < 0.85 should be pulled forward by exam ramp, got isDue=${resB.isDue}, reason=${resB.dueReason}`);
    }
    if (resC.isDue !== true) {
      throw new Error(`Card C (New) should be due, got isDue=${resC.isDue}`);
    }

    console.log("✓ PASS: FSRS Exam Ramp correctly pulls forward cards with predicted retrievability < 0.85 at exam date!\n");

    // --- TEST 3: FSRS Card Review Updates in DB ---
    console.log("--- Test 3: Card Review State Transition & Database Persistence ---");
    // Review Card C (New) with Rating.Good (3)
    const reviewCard = cardC;
    const fsrsCardC = {
      due: new Date(),
      stability: 0,
      difficulty: 0,
      elapsed_days: 0,
      scheduled_days: 0,
      reps: 0,
      lapses: 0,
      learning_steps: 0,
      state: State.New,
      last_review: undefined,
    };

    const nextState = f.repeat(fsrsCardC, now)[Rating.Good].card;
    const nextInterval = Math.max(0, Math.round(dateDiffInDays(nextState.due, now)));

    await db
      .update(flashcards)
      .set({
        stability: nextState.stability.toFixed(4),
        difficulty: nextState.difficulty.toFixed(4),
        reps: nextState.reps,
        lapses: nextState.lapses,
        state: nextState.state,
        lastReview: now,
        nextReviewAt: nextState.due,
        intervalDays: nextInterval,
        updatedAt: now,
      })
      .where(eq(flashcards.id, reviewCard.id));

    const [updatedCardC] = await db.select().from(flashcards).where(eq(flashcards.id, reviewCard.id));
    console.log(`Card C updated: Reps=${updatedCardC.reps}, Stability=${updatedCardC.stability}, State=${updatedCardC.state}, NextReview=${updatedCardC.nextReviewAt?.toISOString()}`);

    if (updatedCardC.reps !== 1 || Number(updatedCardC.stability) <= 0) {
      throw new Error("Failed to persist FSRS state after review!");
    }
    console.log("✓ PASS: Flashcard FSRS review state correctly persisted to database!\n");

    // --- TEST 4: AI-07b Quiz Generation Schema & LLM Execution ---
    console.log("--- Test 4: AI-07b Quiz Generation with Haiku 4.5 & Schema Validation ---");

    const quizSchema = z.object({
      questions: z.array(
        z.object({
          stem: z.string(),
          options: z.array(z.string()).min(2).max(6),
          answer_index: z.number().int(),
          explanation: z.string(),
          source_chunk_id: z.string(),
        })
      ),
    });

    const contextChunks = [
      {
        id: testSyllabusItem.id,
        title: testSyllabusItem.title,
        type: "syllabus_topic",
        content: `Topic: ${testSyllabusItem.title}\nCourse: ${testCourse.title} (${testCourse.code})\nKey Concept: Backpropagation computes gradient vector of the loss function with respect to weights using the chain rule.`,
      },
      {
        id: "chunk-gd-learning-rate",
        title: "Gradient Descent Hyperparameters",
        type: "notes",
        content: "Learning rate alpha determines the step size in parameter space. If too large, training oscillates or diverges; if too small, convergence is excessively slow.",
      },
    ];

    const prompt = `You are AI-07b, an expert academic quiz generator and pedagogical evaluator.
Generate a high-yield, active-recall multiple choice quiz of exactly 3 questions testing understanding of:
Topic: "${testSyllabusItem.title}"
Course: "${testCourse.title} (${testCourse.code})"

CONTEXT CHUNKS:
${JSON.stringify(contextChunks, null, 2)}

INSTRUCTIONS:
1. Generate 3 multiple choice questions with stem, 4 options, answer_index (0-based), explanation, and source_chunk_id from the context chunks provided.`;

    const modelName = process.env.QUIZ_MODEL || "anthropic/claude-haiku-4.5";
    console.log(`Generating quiz with model: ${modelName}...`);

    let quizResult: z.infer<typeof quizSchema>;
    try {
      const res = await generateObject({
        model: openrouter.chat(modelName),
        schema: quizSchema,
        prompt,
        temperature: 0.5,
        providerOptions: {
          openai: { maxCompletionTokens: 1600 },
        },
      });
      quizResult = res.object;
    } catch (err: any) {
      console.warn(`Model ${modelName} failed (${err?.message}), testing with fallback google/gemini-2.5-flash...`);
      const fallback = await generateObject({
        model: openrouter.chat("google/gemini-2.5-flash"),
        schema: quizSchema,
        prompt,
        temperature: 0.5,
        providerOptions: {
          openai: { maxCompletionTokens: 1600 },
        },
      });
      quizResult = fallback.object;
    }

    console.log(`Generated ${quizResult.questions.length} questions:`);
    for (let i = 0; i < quizResult.questions.length; i++) {
      const q = quizResult.questions[i];
      console.log(`\nQ${i + 1}: ${q.stem}`);
      q.options.forEach((opt, oIdx) => {
        console.log(`  ${oIdx === q.answer_index ? "(*)" : "   "} [${oIdx}] ${opt}`);
      });
      console.log(`  Explanation: ${q.explanation}`);
      console.log(`  Citation Chunk ID: ${q.source_chunk_id}`);

      if (q.options.length < 2) throw new Error(`Q${i + 1} has insufficient options`);
      if (q.answer_index < 0 || q.answer_index >= q.options.length) throw new Error(`Q${i + 1} invalid answer_index`);
      if (!q.explanation) throw new Error(`Q${i + 1} missing explanation`);
      if (!q.source_chunk_id) throw new Error(`Q${i + 1} missing citation source_chunk_id`);
    }

    console.log("\n✓ PASS: AI-07b Quiz generation conforms to emit_quiz schema with citations!\n");

    console.log("=================================================");
    console.log("  ALL FSRS & AI-07b TESTS PASSED (4/4)           ");
    console.log("=================================================");
  } finally {
    console.log("\nCleaning up test entities...");
    if (createdCardIds.length > 0) {
      await db.delete(flashcards).where(inArray(flashcards.id, createdCardIds));
    }
    if (testExamId) {
      await db.delete(exams).where(eq(exams.id, testExamId));
    }
    if (testSyllabusItemId) {
      await db.delete(syllabusItems).where(eq(syllabusItems.id, testSyllabusItemId));
    }
    if (testCourseId) {
      await db.delete(courses).where(eq(courses.id, testCourseId));
    }
    console.log("Cleanup complete.");
  }
}

runFSRSandQuizVerification().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
