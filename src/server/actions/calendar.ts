"use server";

import { db } from "@/server/db";
import { timeBlocks, tasks, userSettings, users } from "@/server/db/schema";
import { eq, and, isNull, gte, lte, lt, gt, ne, or, asc, desc } from "drizzle-orm";
import { getCurrentUser } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export type TimeBlockKind = "work" | "study" | "rest" | "admin";

export interface TimeBlockWithTask {
  id: string;
  userId: string;
  title: string | null;
  startAt: Date;
  endAt: Date;
  taskId: string | null;
  studySessionId: string | null;
  kind: TimeBlockKind;
  locked: boolean;
  createdAt: Date;
  updatedAt: Date;
  task?: {
    id: string;
    title: string;
    priority: number | null;
    status: string;
    estimateMinutes: number | null;
    energy: string | null;
  } | null;
}

export interface CreateTimeBlockInput {
  title?: string;
  startAt: Date | string;
  endAt: Date | string;
  taskId?: string | null;
  studySessionId?: string | null;
  kind?: TimeBlockKind;
  locked?: boolean;
  allowOverlap?: boolean;
}

export interface UpdateTimeBlockInput {
  title?: string;
  startAt?: Date | string;
  endAt?: Date | string;
  taskId?: string | null;
  studySessionId?: string | null;
  kind?: TimeBlockKind;
  locked?: boolean;
  allowOverlap?: boolean;
}

export async function getTimeBlocks(
  startDate: Date | string,
  endDate: Date | string,
  explicitUserId?: string
): Promise<TimeBlockWithTask[]> {
  const user = explicitUserId ? { id: explicitUserId } : await getCurrentUser();
  if (!user) return [];

  const start = new Date(startDate);
  const end = new Date(endDate);

  try {
    const blocks = await db
      .select({
        id: timeBlocks.id,
        userId: timeBlocks.userId,
        title: timeBlocks.title,
        startAt: timeBlocks.startAt,
        endAt: timeBlocks.endAt,
        taskId: timeBlocks.taskId,
        studySessionId: timeBlocks.studySessionId,
        kind: timeBlocks.kind,
        locked: timeBlocks.locked,
        createdAt: timeBlocks.createdAt,
        updatedAt: timeBlocks.updatedAt,
        taskTitle: tasks.title,
        taskPriority: tasks.priority,
        taskStatus: tasks.status,
        taskEstimateMinutes: tasks.estimateMinutes,
        taskEnergy: tasks.energy,
      })
      .from(timeBlocks)
      .leftJoin(tasks, eq(timeBlocks.taskId, tasks.id))
      .where(
        and(
          eq(timeBlocks.userId, user.id),
          isNull(timeBlocks.deletedAt),
          lt(timeBlocks.startAt, end),
          gt(timeBlocks.endAt, start)
        )
      )
      .orderBy(asc(timeBlocks.startAt));

    return blocks.map((b) => ({
      id: b.id,
      userId: b.userId,
      title: b.title || b.taskTitle || "Time Block",
      startAt: b.startAt,
      endAt: b.endAt,
      taskId: b.taskId,
      studySessionId: b.studySessionId,
      kind: (b.kind as TimeBlockKind) || "work",
      locked: b.locked,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
      task: b.taskId
        ? {
            id: b.taskId,
            title: b.taskTitle || "",
            priority: b.taskPriority,
            status: b.taskStatus || "inbox",
            estimateMinutes: b.taskEstimateMinutes,
            energy: b.taskEnergy,
          }
        : null,
    }));
  } catch (error) {
    console.error("[getTimeBlocks Error]:", error);
    return [];
  }
}

export async function createTimeBlock(
  input: CreateTimeBlockInput,
  explicitUserId?: string
): Promise<{
  success: boolean;
  timeBlock?: TimeBlockWithTask;
  error?: string;
  conflict?: any;
  message?: string;
}> {
  const user = explicitUserId ? { id: explicitUserId } : await getCurrentUser();
  if (!user) {
    return { success: false, error: "UNAUTHORIZED", message: "User not authenticated" };
  }

  const startAt = new Date(input.startAt);
  const endAt = new Date(input.endAt);

  if (isNaN(startAt.getTime()) || isNaN(endAt.getTime()) || startAt >= endAt) {
    return {
      success: false,
      error: "INVALID_TIME_RANGE",
      message: "End time must be after start time",
    };
  }

  try {
    // 1. Overlap Conflict Detection (unless allowOverlap is true)
    if (!input.allowOverlap) {
      const overlapping = await db
        .select({
          id: timeBlocks.id,
          title: timeBlocks.title,
          startAt: timeBlocks.startAt,
          endAt: timeBlocks.endAt,
        })
        .from(timeBlocks)
        .where(
          and(
            eq(timeBlocks.userId, user.id),
            isNull(timeBlocks.deletedAt),
            lt(timeBlocks.startAt, endAt),
            gt(timeBlocks.endAt, startAt)
          )
        )
        .limit(1);

      if (overlapping.length > 0) {
        return {
          success: false,
          error: "OVERLAP_CONFLICT",
          conflict: overlapping[0],
          message: `This time block overlaps with "${overlapping[0].title || "an existing block"}" (${new Date(
            overlapping[0].startAt
          ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${new Date(
            overlapping[0].endAt
          ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}).`,
        };
      }
    }

    // 2. Resolve task title if not provided
    let finalTitle = input.title;
    if (!finalTitle && input.taskId) {
      const [linkedTask] = await db
        .select({ title: tasks.title })
        .from(tasks)
        .where(and(eq(tasks.id, input.taskId), eq(tasks.userId, user.id)))
        .limit(1);
      if (linkedTask) {
        finalTitle = linkedTask.title;
      }
    }

    // 3. Insert Time Block
    const [created] = await db
      .insert(timeBlocks)
      .values({
        userId: user.id,
        title: finalTitle || "Scheduled Block",
        startAt,
        endAt,
        taskId: input.taskId || null,
        studySessionId: input.studySessionId || null,
        kind: input.kind || "work",
        locked: input.locked ?? false,
      })
      .returning();

    try {
      revalidatePath("/calendar");
      revalidatePath("/");
    } catch {}

    const resultList = await getTimeBlocks(
      new Date(startAt.getTime() - 1000),
      new Date(endAt.getTime() + 1000),
      user.id
    );
    const fullBlock = resultList.find((b) => b.id === created.id) || {
      ...created,
      kind: (created.kind as TimeBlockKind) || "work",
      task: null,
    };

    return {
      success: true,
      timeBlock: fullBlock,
    };
  } catch (error: any) {
    console.error("[createTimeBlock Error]:", error);
    return {
      success: false,
      error: "DATABASE_ERROR",
      message: error?.message || "Failed to create time block",
    };
  }
}

export async function updateTimeBlock(
  id: string,
  input: UpdateTimeBlockInput,
  explicitUserId?: string
): Promise<{
  success: boolean;
  timeBlock?: TimeBlockWithTask;
  error?: string;
  conflict?: any;
  message?: string;
}> {
  const user = explicitUserId ? { id: explicitUserId } : await getCurrentUser();
  if (!user) {
    return { success: false, error: "UNAUTHORIZED", message: "User not authenticated" };
  }

  try {
    const [existing] = await db
      .select()
      .from(timeBlocks)
      .where(and(eq(timeBlocks.id, id), eq(timeBlocks.userId, user.id), isNull(timeBlocks.deletedAt)))
      .limit(1);

    if (!existing) {
      return { success: false, error: "NOT_FOUND", message: "Time block not found" };
    }

    const startAt = input.startAt ? new Date(input.startAt) : existing.startAt;
    const endAt = input.endAt ? new Date(input.endAt) : existing.endAt;

    if (startAt >= endAt) {
      return {
        success: false,
        error: "INVALID_TIME_RANGE",
        message: "End time must be after start time",
      };
    }

    // Overlap conflict check excluding self
    if (!input.allowOverlap && (input.startAt || input.endAt)) {
      const overlapping = await db
        .select({
          id: timeBlocks.id,
          title: timeBlocks.title,
          startAt: timeBlocks.startAt,
          endAt: timeBlocks.endAt,
        })
        .from(timeBlocks)
        .where(
          and(
            eq(timeBlocks.userId, user.id),
            ne(timeBlocks.id, id),
            isNull(timeBlocks.deletedAt),
            lt(timeBlocks.startAt, endAt),
            gt(timeBlocks.endAt, startAt)
          )
        )
        .limit(1);

      if (overlapping.length > 0) {
        return {
          success: false,
          error: "OVERLAP_CONFLICT",
          conflict: overlapping[0],
          message: `This time block overlaps with "${overlapping[0].title || "an existing block"}" (${new Date(
            overlapping[0].startAt
          ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${new Date(
            overlapping[0].endAt
          ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}).`,
        };
      }
    }

    const [updated] = await db
      .update(timeBlocks)
      .set({
        title: input.title !== undefined ? input.title : existing.title,
        startAt,
        endAt,
        taskId: input.taskId !== undefined ? input.taskId : existing.taskId,
        studySessionId:
          input.studySessionId !== undefined ? input.studySessionId : existing.studySessionId,
        kind: input.kind !== undefined ? input.kind : existing.kind,
        locked: input.locked !== undefined ? input.locked : existing.locked,
        updatedAt: new Date(),
      })
      .where(eq(timeBlocks.id, id))
      .returning();

    try {
      revalidatePath("/calendar");
      revalidatePath("/");
    } catch {}

    const resultList = await getTimeBlocks(
      new Date(startAt.getTime() - 1000),
      new Date(endAt.getTime() + 1000),
      user.id
    );
    const fullBlock = resultList.find((b) => b.id === updated.id) || {
      ...updated,
      kind: (updated.kind as TimeBlockKind) || "work",
      task: null,
    };

    return { success: true, timeBlock: fullBlock };
  } catch (error: any) {
    console.error("[updateTimeBlock Error]:", error);
    return {
      success: false,
      error: "DATABASE_ERROR",
      message: error?.message || "Failed to update time block",
    };
  }
}

export async function deleteTimeBlock(
  id: string,
  explicitUserId?: string
): Promise<{ success: boolean; error?: string }> {
  const user = explicitUserId ? { id: explicitUserId } : await getCurrentUser();
  if (!user) {
    return { success: false, error: "UNAUTHORIZED" };
  }

  try {
    await db
      .update(timeBlocks)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(timeBlocks.id, id), eq(timeBlocks.userId, user.id)));

    try {
      revalidatePath("/calendar");
      revalidatePath("/");
    } catch {}

    return { success: true };
  } catch (error: any) {
    console.error("[deleteTimeBlock Error]:", error);
    return { success: false, error: error?.message || "Failed to delete time block" };
  }
}

export async function getCalendarData(
  startDate: Date | string,
  endDate: Date | string,
  explicitUserId?: string
) {
  const user = explicitUserId ? { id: explicitUserId } : await getCurrentUser();
  if (!user) {
    return {
      timeBlocks: [],
      availableMinutesPerDay: 300,
      unscheduledTasks: [],
    };
  }

  const [blocks, userSettingRows, activeTasks] = await Promise.all([
    getTimeBlocks(startDate, endDate, user.id),
    db
      .select({ availableMinutesPerDay: userSettings.availableMinutesPerDay })
      .from(userSettings)
      .where(and(eq(userSettings.userId, user.id), isNull(userSettings.deletedAt)))
      .limit(1),
    db
      .select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        priority: tasks.priority,
        estimateMinutes: tasks.estimateMinutes,
        dueAt: tasks.dueAt,
        energy: tasks.energy,
        sortKey: tasks.sortKey,
      })
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, user.id),
          isNull(tasks.deletedAt),
          or(eq(tasks.status, "inbox"), eq(tasks.status, "next"), eq(tasks.status, "in_progress"))
        )
      )
      .orderBy(asc(tasks.sortKey), desc(tasks.createdAt)),
  ]);

  const availableMinutesPerDay = userSettingRows[0]?.availableMinutesPerDay || 300;

  return {
    timeBlocks: blocks,
    availableMinutesPerDay,
    unscheduledTasks: activeTasks,
  };
}
