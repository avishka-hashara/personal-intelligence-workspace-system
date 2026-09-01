"use server";

import { parse } from "csv-parse/sync";
import { db } from "@/server/db";
import { tasks, flashcards, courses } from "@/server/db/schema";
import { eq, and, asc, isNull } from "drizzle-orm";
import { getCurrentUser } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { generateKeyBetween } from "fractional-indexing";
import * as chrono from "chrono-node";

export interface ImportResult {
  success: boolean;
  count: number;
  error?: string;
}

/**
 * Task 3: Import tasks from a Todoist CSV export file.
 * Extracts uploaded CSV, maps CONTENT -> task title and DUE DATE -> due_at,
 * and bulk inserts records into the tasks table.
 */
export async function importTodoistCSV(
  formData: FormData,
  explicitUserId?: string
): Promise<ImportResult> {
  const user = explicitUserId ? { id: explicitUserId } : await getCurrentUser();
  if (!user) {
    return { success: false, count: 0, error: "Unauthorized" };
  }

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    return { success: false, count: 0, error: "No CSV file provided" };
  }

  try {
    const text = await file.text();
    if (!text || text.trim().length === 0) {
      return { success: false, count: 0, error: "Uploaded CSV file is empty" };
    }

    // Parse CSV with csv-parse/sync
    const records: Record<string, string>[] = parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      bom: true,
    });

    if (records.length === 0) {
      return { success: false, count: 0, error: "No records found in CSV" };
    }

    // Get current top task sortKey for fractional indexing
    const [topTask] = await db
      .select({ sortKey: tasks.sortKey })
      .from(tasks)
      .where(eq(tasks.userId, user.id))
      .orderBy(asc(tasks.sortKey))
      .limit(1);

    let lastSortKey: string | null = topTask?.sortKey ?? null;

    const tasksToInsert: Array<{
      userId: string;
      title: string;
      notes: string | null;
      status: string;
      priority: number;
      dueAt: Date | null;
      sortKey: string;
    }> = [];

    for (const row of records) {
      // Look for CONTENT or title columns case-insensitively
      const contentKey = Object.keys(row).find((k) =>
        /^(content|title|task|item)$/i.test(k.trim())
      );
      const title = contentKey ? row[contentKey]?.trim() : "";

      if (!title) {
        continue;
      }

      // Look for DUE DATE or date columns
      const dueDateKey = Object.keys(row).find((k) =>
        /^(due date|due_date|due_at|due|date)$/i.test(k.trim())
      );
      const dueDateRaw = dueDateKey ? row[dueDateKey]?.trim() : null;

      let dueAt: Date | null = null;
      if (dueDateRaw) {
        // Try parsing ISO / standard date first
        const parsedDate = new Date(dueDateRaw);
        if (!isNaN(parsedDate.getTime())) {
          dueAt = parsedDate;
        } else {
          // Fallback to chrono NLP parser for flexible human dates like 'tomorrow 5pm' or '15 Sep'
          const chronoParsed = chrono.parseDate(dueDateRaw);
          if (chronoParsed) {
            dueAt = chronoParsed;
          }
        }
      }

      // Look for DESCRIPTION / notes column
      const descKey = Object.keys(row).find((k) =>
        /^(description|notes|details|note)$/i.test(k.trim())
      );
      const notes = descKey && row[descKey] ? row[descKey].trim() : null;

      // Look for PRIORITY column (Todoist priority: 4=p1/urgent, 3=p2, 2=p3, 1=p4/normal)
      const priorityKey = Object.keys(row).find((k) => /^priority$/i.test(k.trim()));
      let priority = 0;
      if (priorityKey && row[priorityKey]) {
        const rawPrio = parseInt(row[priorityKey].trim(), 10);
        if (!isNaN(rawPrio)) {
          // Map Todoist 1-4 scale to PIW 0-3 scale
          priority = Math.min(3, Math.max(0, 4 - rawPrio));
        }
      }

      // Generate fractional sortKey
      const sortKey = generateKeyBetween(null, lastSortKey);
      lastSortKey = sortKey;

      tasksToInsert.push({
        userId: user.id,
        title,
        notes,
        status: "next",
        priority,
        dueAt,
        sortKey,
      });
    }

    if (tasksToInsert.length === 0) {
      return {
        success: false,
        count: 0,
        error: "No valid tasks could be extracted (ensure column 'CONTENT' exists)",
      };
    }

    // Bulk insert tasks in chunks to respect database parameter limits
    const CHUNK_SIZE = 100;
    let totalInserted = 0;

    for (let i = 0; i < tasksToInsert.length; i += CHUNK_SIZE) {
      const chunk = tasksToInsert.slice(i, i + CHUNK_SIZE);
      const inserted = await db.insert(tasks).values(chunk).returning({ id: tasks.id });
      totalInserted += inserted.length;
    }

    try {
      revalidatePath("/");
      revalidatePath("/tasks");
      revalidatePath("/settings/data");
    } catch {}

    return { success: true, count: totalInserted };
  } catch (error: any) {
    console.error("Failed to import Todoist CSV:", error);
    return { success: false, count: 0, error: error?.message || "Failed to parse and import CSV" };
  }
}

/**
 * Task 3: Import flashcards from an Anki TSV (tab-separated) file into a target course.
 * Maps Column 1 -> front, Column 2 -> back, initializes state to 'new' (0), and bulk inserts.
 */
export async function importAnkiTSV(
  courseId: string,
  formData: FormData,
  explicitUserId?: string
): Promise<ImportResult> {
  const user = explicitUserId ? { id: explicitUserId } : await getCurrentUser();
  if (!user) {
    return { success: false, count: 0, error: "Unauthorized" };
  }

  const targetCourseId = courseId || (formData.get("courseId") as string);
  if (!targetCourseId) {
    return { success: false, count: 0, error: "Target course must be selected" };
  }

  // Verify course belongs to user
  const [course] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(and(eq(courses.id, targetCourseId), eq(courses.userId, user.id), isNull(courses.deletedAt)))
    .limit(1);

  if (!course) {
    return { success: false, count: 0, error: "Selected course not found" };
  }

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    return { success: false, count: 0, error: "No TSV file provided" };
  }

  try {
    const text = await file.text();
    if (!text || text.trim().length === 0) {
      return { success: false, count: 0, error: "Uploaded TSV file is empty" };
    }

    // Parse tab-separated values, skipping comment headers (#...)
    const rows: string[][] = parse(text, {
      delimiter: "\t",
      relax_column_count: true,
      skip_empty_lines: true,
      comment: "#",
      trim: true,
    });

    if (rows.length === 0) {
      return { success: false, count: 0, error: "No valid rows found in TSV" };
    }

    const cardsToInsert: Array<{
      userId: string;
      courseId: string;
      front: string;
      back: string;
      nextReviewAt: Date;
      intervalDays: number;
      stability: string;
      difficulty: string;
      reps: number;
      lapses: number;
      state: number;
      lastReview: null;
    }> = [];

    const now = new Date();

    for (const row of rows) {
      if (row.length < 2) continue;

      const front = row[0]?.trim();
      const back = row[1]?.trim();

      if (!front || !back) continue;

      cardsToInsert.push({
        userId: user.id,
        courseId: targetCourseId,
        front,
        back,
        nextReviewAt: now,
        intervalDays: 0,
        stability: "0",
        difficulty: "0",
        reps: 0,
        lapses: 0,
        state: 0, // 0: State.New in FSRS
        lastReview: null,
      });
    }

    if (cardsToInsert.length === 0) {
      return {
        success: false,
        count: 0,
        error: "No valid flashcard pairs found. Ensure each line has Front and Back separated by a tab.",
      };
    }

    // Bulk insert flashcards in chunks
    const CHUNK_SIZE = 100;
    let totalInserted = 0;

    for (let i = 0; i < cardsToInsert.length; i += CHUNK_SIZE) {
      const chunk = cardsToInsert.slice(i, i + CHUNK_SIZE);
      const inserted = await db.insert(flashcards).values(chunk).returning({ id: flashcards.id });
      totalInserted += inserted.length;
    }

    try {
      revalidatePath(`/study/courses/${targetCourseId}`);
      revalidatePath("/study/courses");
      revalidatePath("/settings/data");
    } catch {}

    return { success: true, count: totalInserted };
  } catch (error: any) {
    console.error("Failed to import Anki TSV:", error);
    return { success: false, count: 0, error: error?.message || "Failed to parse and import TSV" };
  }
}
