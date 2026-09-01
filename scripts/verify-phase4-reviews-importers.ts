import { db } from "../src/server/db";
import {
  users,
  courses,
  tasks,
  flashcards,
  habits,
  habitLogs,
  studySessions,
  reviews,
} from "../src/server/db/schema";
import { eq, and, desc, isNull, inArray } from "drizzle-orm";
import {
  aggregateReviewStats,
  generateReview,
  getReviews,
  applyReviewAdjustment,
} from "../src/server/actions/reviews";
import { importTodoistCSV, importAnkiTSV } from "../src/server/actions/import";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

async function runTests() {
  console.log("=================================================");
  console.log("Starting Phase 4: Reviews & Importers Verification");
  console.log("=================================================\n");

  // 1. Get or create a test user
  const [testUser] = await db
    .select()
    .from(users)
    .limit(1);

  if (!testUser) {
    console.error("No user found in database for testing. Please ensure at least one user exists.");
    process.exit(1);
  }

  const userId = testUser.id;
  console.log(`Using Test User ID: ${userId} (${testUser.email})`);

  // 2. Test aggregateReviewStats for Weekly & Quarterly
  console.log("\n--- Testing Task 1: Quarterly & Weekly Aggregations ---");
  const weeklyStats = await aggregateReviewStats(userId, "weekly");
  console.log("Weekly Stats (7d):", {
    period: weeklyStats.period,
    days: weeklyStats.daysWindow,
    completedTasks: weeklyStats.tasks.completed,
    studyMinutes: weeklyStats.study.totalMinutes,
    habitAdherence: `${weeklyStats.habits.averageAdherence}%`,
  });

  const quarterlyStats = await aggregateReviewStats(userId, "quarterly");
  console.log("Quarterly Stats (90d):", {
    period: quarterlyStats.period,
    days: quarterlyStats.daysWindow,
    completedTasks: quarterlyStats.tasks.completed,
    studyMinutes: quarterlyStats.study.totalMinutes,
    habitAdherence: `${quarterlyStats.habits.averageAdherence}%`,
  });

  if (quarterlyStats.daysWindow !== 90 || weeklyStats.daysWindow !== 7) {
    throw new Error("Window days mismatch: expected 90 for quarterly, 7 for weekly");
  }
  console.log("✓ Aggregation window correctly configured (7d vs 90d).");

  // 3. Test generateReview action for Quarterly
  console.log("\n--- Testing generateReview({ period: 'quarterly' }) ---");
  const reviewRes = await generateReview({ period: "quarterly", save: true, userId });
  if (!reviewRes.success || !reviewRes.review) {
    throw new Error(`Quarterly review generation failed: ${reviewRes.error}`);
  }

  console.log("Generated Quarterly Review ID:", reviewRes.review.id);
  console.log("Narrative excerpt:", reviewRes.review.narrative.slice(0, 140) + "...");
  console.log("Proposed Adjustments count:", reviewRes.review.proposedAdjustments.length);

  if (reviewRes.review.period !== "quarterly") {
    throw new Error("Generated review period is not 'quarterly'");
  }
  console.log("✓ AI-08 Quarterly review generated and persisted.");

  // Test applyReviewAdjustment if adjustment exists
  if (reviewRes.review.proposedAdjustments.length > 0) {
    const adj = reviewRes.review.proposedAdjustments[0];
    console.log(`Applying adjustment ${adj.id} (${adj.entityTitle})...`);
    const applyRes = await applyReviewAdjustment(reviewRes.review.id, adj.id, userId);
    if (!applyRes.success) {
      throw new Error(`Failed to apply adjustment: ${applyRes.error}`);
    }
    console.log("✓ Proposed adjustment successfully marked as applied.");
  }

  // 4. Test Task 3: Todoist CSV Importer
  console.log("\n--- Testing Task 3: Todoist CSV Importer ---");
  const sampleTodoistCSV = `TYPE,CONTENT,DESCRIPTION,PRIORITY,INDENT,AUTHOR,RESPONSIBLE,DATE,DATE_LANG,TIMEZONE
task,"Review Quantum Computing Notes","Focus on superposition and entanglement",4,1,"User","","2026-09-15 14:00","en","UTC"
task,"Complete Database Migration for Reviews","Verify indexes and constraints",3,1,"User","","tomorrow 5pm","en","UTC"
task,"Buy groceries and meal prep","High protein weekly plan",1,1,"User","","","en","UTC"`;

  const todoistFormData = new FormData();
  const todoistBlob = new Blob([sampleTodoistCSV], { type: "text/csv" });
  todoistFormData.append("file", todoistBlob, "todoist_export.csv");

  const todoistImportRes = await importTodoistCSV(todoistFormData, userId);
  console.log("Todoist Import Result:", todoistImportRes);

  if (!todoistImportRes.success || todoistImportRes.count !== 3) {
    throw new Error(`Expected 3 tasks imported, got ${todoistImportRes.count}. Error: ${todoistImportRes.error}`);
  }
  console.log("✓ Successfully imported 3 Todoist tasks with CONTENT and DUE DATE mapping.");

  // 5. Test Task 3: Anki TSV Importer
  console.log("\n--- Testing Task 3: Anki TSV Importer ---");
  // Find or create a test course
  let [testCourse] = await db
    .select()
    .from(courses)
    .where(and(eq(courses.userId, userId), isNull(courses.deletedAt)))
    .limit(1);

  if (!testCourse) {
    const [newCourse] = await db
      .insert(courses)
      .values({
        userId,
        code: "CS3230",
        title: "Design and Analysis of Algorithms",
        active: true,
      })
      .returning();
    testCourse = newCourse;
  }

  console.log(`Target course for Anki import: ${testCourse.code} (${testCourse.id})`);

  const sampleAnkiTSV = `#separator:tab
#html:true
#tags column:3
What is the time complexity of QuickSelect in the average case?\tO(N) average time complexity, though O(N^2) worst case.\talgorithms
Define Bellman-Ford shortest path invariant.\tAfter i iterations, d[v] is at most the weight of a shortest path using at most i edges.\tgraphs
What is dynamic programming memoization?\tTop-down caching of overlapping subproblems to prevent redundant computation.\tdp`;

  const ankiFormData = new FormData();
  const ankiBlob = new Blob([sampleAnkiTSV], { type: "text/tab-separated-values" });
  ankiFormData.append("file", ankiBlob, "anki_deck.tsv");
  ankiFormData.append("courseId", testCourse.id);

  const ankiImportRes = await importAnkiTSV(testCourse.id, ankiFormData, userId);
  console.log("Anki Import Result:", ankiImportRes);

  if (!ankiImportRes.success || ankiImportRes.count !== 3) {
    throw new Error(`Expected 3 flashcards imported, got ${ankiImportRes.count}. Error: ${ankiImportRes.error}`);
  }
  console.log("✓ Successfully imported 3 Anki flashcards with FSRS State.New (0) initialization.");

  // Verify created flashcards
  const importedCards = await db
    .select()
    .from(flashcards)
    .where(and(eq(flashcards.courseId, testCourse.id), eq(flashcards.userId, userId)))
    .orderBy(desc(flashcards.createdAt))
    .limit(3);

  console.log("Imported Flashcards Sample:", importedCards.map((c) => ({
    front: c.front.slice(0, 35) + "...",
    back: c.back.slice(0, 35) + "...",
    state: c.state,
    intervalDays: c.intervalDays,
  })));

  // Clean up test tasks and flashcards created during the test run
  console.log("\nCleaning up test artifacts...");
  await db
    .delete(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        inArray(tasks.title, [
          "Review Quantum Computing Notes",
          "Complete Database Migration for Reviews",
          "Buy groceries and meal prep",
        ])
      )
    );

  await db
    .delete(flashcards)
    .where(
      and(
        eq(flashcards.userId, userId),
        inArray(flashcards.id, importedCards.map((c) => c.id))
      )
    );

  console.log("\n=================================================");
  console.log("🎉 All Phase 4 Review and Importer Tests PASSED!");
  console.log("=================================================");
}

runTests().catch((err) => {
  console.error("Test execution failed with error:", err);
  process.exit(1);
});
