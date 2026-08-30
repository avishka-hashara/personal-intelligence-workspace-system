"use server";

import * as chrono from "chrono-node";
import { RRule } from "rrule";
import { db } from "@/server/db";
import { tasks, tags, nodeTags, nodes, focusSessions, milestones, stages, roadmaps, goals } from "@/server/db/schema";
import { eq, and, asc, desc, isNull, sql } from "drizzle-orm";
import { getCurrentUser } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { generateKeyBetween } from "fractional-indexing";

export interface CreateTaskInput {
    id?: string;
    title: string;
    parentTaskId?: string | null;
    dueAt?: Date | string | null;
    sortKey?: string | null;
}

export async function createTask(input: FormData | CreateTaskInput) {
    let rawTitle = "";
    let parentTaskId: string | null = null;
    let explicitId: string | undefined = undefined;
    let explicitSortKey: string | null | undefined = undefined;
    let explicitDueAt: Date | null | undefined = undefined;

    if (input instanceof FormData) {
        rawTitle = (input.get("title") as string) || "";
        parentTaskId = (input.get("parentTaskId") as string) || null;
        explicitId = (input.get("id") as string) || undefined;
        explicitSortKey = (input.get("sortKey") as string) || undefined;
        const dueAtVal = input.get("dueAt") as string | null;
        if (dueAtVal) {
            explicitDueAt = new Date(dueAtVal);
        }
    } else {
        rawTitle = input.title;
        parentTaskId = input.parentTaskId ?? null;
        explicitId = input.id;
        explicitSortKey = input.sortKey;
        if (input.dueAt) {
            explicitDueAt = typeof input.dueAt === "string" ? new Date(input.dueAt) : input.dueAt;
        }
    }

    if (!rawTitle || rawTitle.trim() === "") {
        return { error: "Title is required" };
    }

    const user = await getCurrentUser();
    if (!user) {
        return { error: "Unauthorized" };
    }

    let dueAt: Date | null = explicitDueAt ?? null;
    let title = rawTitle.trim();

    if (!explicitDueAt) {
        const parsed = chrono.parse(rawTitle);
        if (parsed.length > 0) {
            dueAt = parsed[0].start.date();
            const cleaned = title.replace(parsed[0].text, "").replace(/\s+/g, " ").trim();
            if (cleaned.length > 0) {
                title = cleaned;
            }
        }
    }

    try {
        let sortKey = explicitSortKey;
        if (!sortKey) {
            const [topTask] = await db
                .select({ sortKey: tasks.sortKey })
                .from(tasks)
                .where(eq(tasks.userId, user.id))
                .orderBy(asc(tasks.sortKey))
                .limit(1);

            sortKey = generateKeyBetween(null, topTask?.sortKey ?? null);
        }

        const [insertedTask] = await db.insert(tasks).values({
            id: explicitId,
            userId: user.id,
            title,
            status: "next",
            dueAt,
            sortKey,
            parentTaskId: parentTaskId ? parentTaskId : null,
        }).returning();

        revalidatePath("/");
        revalidatePath("/tasks");
        return { success: true, task: insertedTask };
    } catch (error) {
        console.error("Failed to create task:", error);
        return { error: "Failed to create task" };
    }
}

export async function updateTask(
    id: string,
    data: {
        title?: string;
        notes?: string | null;
        rrule?: string | null;
        status?: string;
        priority?: number;
        energy?: string | null;
        dueAt?: Date | null;
        milestoneId?: string | null;
        [key: string]: unknown;
    }
) {
    const user = await getCurrentUser();
    if (!user) return { error: "Unauthorized" };

    try {
        const [updatedTask] = await db.update(tasks)
            .set({ ...data, updatedAt: new Date() })
            .where(and(eq(tasks.id, id), eq(tasks.userId, user.id)))
            .returning();

        revalidatePath("/");
        revalidatePath("/tasks");
        return { success: true, task: updatedTask };
    } catch (error) {
        console.error("Failed to update task:", error);
        return { error: "Failed to update task" };
    }
}

export async function toggleTaskStatus(id: string, currentStatus: string) {
    const user = await getCurrentUser();
    if (!user) return { error: "Unauthorized" };

    try {
        const [task] = await db
            .select()
            .from(tasks)
            .where(and(eq(tasks.id, id), eq(tasks.userId, user.id)))
            .limit(1);

        if (!task) return { error: "Task not found" };

        const newStatus = currentStatus === "done" ? "next" : "done";
        const isCompleting = newStatus === "done";

        if (isCompleting && task.rrule) {
            // Check if a child instance has already been spawned for this recurrence
            const [existingChild] = await db
                .select({ id: tasks.id })
                .from(tasks)
                .where(
                    and(
                        eq(tasks.userId, user.id),
                        eq(tasks.recurrenceParentId, task.id),
                        eq(tasks.rrule, task.rrule),
                        isNull(tasks.deletedAt)
                    )
                )
                .limit(1);

            if (!existingChild) {
                try {
                    const rule = RRule.fromString(task.rrule);
                    const baseDate = task.dueAt ? new Date(task.dueAt) : new Date();
                    const nextDate = rule.after(baseDate);

                    if (nextDate) {
                        const [topTask] = await db
                            .select({ sortKey: tasks.sortKey })
                            .from(tasks)
                            .where(eq(tasks.userId, user.id))
                            .orderBy(asc(tasks.sortKey))
                            .limit(1);

                        const sortKey = generateKeyBetween(null, topTask?.sortKey ?? null);

                        await db.insert(tasks).values({
                            userId: user.id,
                            title: task.title,
                            notes: task.notes,
                            priority: task.priority,
                            energy: task.energy,
                            rrule: task.rrule,
                            dueAt: nextDate,
                            status: "next",
                            recurrenceParentId: task.id,
                            sortKey,
                        });
                    }
                } catch (rruleErr) {
                    console.error("Failed to parse recurrence rule or spawn next instance:", rruleErr);
                }
            }
        }

        const [updatedTask] = await db.update(tasks)
            .set({ status: newStatus, updatedAt: new Date() })
            .where(and(eq(tasks.id, id), eq(tasks.userId, user.id)))
            .returning();

        revalidatePath("/");
        revalidatePath("/tasks");
        return { success: true, task: updatedTask };
    } catch (error) {
        console.error("Failed to toggle task status:", error);
        return { error: "Failed to toggle status" };
    }
}

export async function deleteTask(id: string) {
    const user = await getCurrentUser();
    if (!user) return { error: "Unauthorized" };

    try {
        // Cascade delete subtasks
        await db.delete(tasks)
            .where(and(eq(tasks.parentTaskId, id), eq(tasks.userId, user.id)));

        await db.delete(tasks)
            .where(and(eq(tasks.id, id), eq(tasks.userId, user.id)));

        revalidatePath("/");
        revalidatePath("/tasks");
        return { success: true };
    } catch (error) {
        console.error("Failed to delete task:", error);
        return { error: "Failed to delete task" };
    }
}

export async function updateTaskOrder(taskId: string, newSortKey: string) {
    const user = await getCurrentUser();
    if (!user) return { error: "Unauthorized" };

    try {
        const [updatedTask] = await db.update(tasks)
            .set({ sortKey: newSortKey, updatedAt: new Date() })
            .where(and(eq(tasks.id, taskId), eq(tasks.userId, user.id)))
            .returning();

        revalidatePath("/tasks");
        revalidatePath("/");
        return { success: true, task: updatedTask };
    } catch (error) {
        console.error("Failed to update task order:", error);
        return { error: "Failed to update task order" };
    }
}

export async function assignTag(taskId: string, tagName: string) {
    const user = await getCurrentUser();
    if (!user) return { error: "Unauthorized" };

    const cleanName = tagName.trim();
    if (!cleanName) return { error: "Tag name cannot be empty" };

    try {
        // 1. Check if tag exists (case-insensitive) for this user
        const [existingTag] = await db
            .select({ id: tags.id, name: tags.name, colour: tags.colour })
            .from(tags)
            .where(
                and(
                    eq(tags.userId, user.id),
                    sql`lower(${tags.name}) = lower(${cleanName})`,
                    isNull(tags.deletedAt)
                )
            )
            .limit(1);

        let tag = existingTag;

        // 2. If tag doesn't exist, insert it
        if (!tag) {
            const [newTag] = await db
                .insert(tags)
                .values({
                    userId: user.id,
                    name: cleanName,
                })
                .returning({ id: tags.id, name: tags.name, colour: tags.colour });
            tag = newTag;
        }

        // 3. Ensure the node exists in nodes table (safety backfill)
        await db
            .insert(nodes)
            .values({
                id: taskId,
                userId: user.id,
                entityType: "tasks",
                title: "",
            })
            .onConflictDoNothing();

        // 4. Insert into nodeTags junction table (ON CONFLICT DO NOTHING)
        await db
            .insert(nodeTags)
            .values({
                nodeId: taskId,
                tagId: tag.id,
            })
            .onConflictDoNothing();

        revalidatePath("/");
        revalidatePath("/tasks");
        return { success: true, tag };
    } catch (error) {
        console.error("Failed to assign tag:", error);
        return { error: "Failed to assign tag" };
    }
}

export async function removeTag(taskId: string, tagId: string) {
    const user = await getCurrentUser();
    if (!user) return { error: "Unauthorized" };

    try {
        await db
            .delete(nodeTags)
            .where(
                and(
                    eq(nodeTags.nodeId, taskId),
                    eq(nodeTags.tagId, tagId)
                )
            );

        revalidatePath("/");
        revalidatePath("/tasks");
        return { success: true };
    } catch (error) {
        console.error("Failed to remove tag:", error);
        return { error: "Failed to remove tag" };
    }
}

export async function fetchTagsForTask(taskId: string) {
    const user = await getCurrentUser();
    if (!user) return { error: "Unauthorized", tags: [] };

    try {
        const taskTags = await db
            .select({
                id: tags.id,
                name: tags.name,
                colour: tags.colour,
            })
            .from(nodeTags)
            .innerJoin(tags, eq(nodeTags.tagId, tags.id))
            .where(
                and(
                    eq(nodeTags.nodeId, taskId),
                    eq(tags.userId, user.id),
                    isNull(tags.deletedAt)
                )
            )
            .orderBy(asc(tags.name));

        return { success: true, tags: taskTags };
    } catch (error) {
        console.error("Failed to fetch tags for task:", error);
        return { error: "Failed to fetch tags", tags: [] };
    }
}

export async function getAllUserTags() {
    const user = await getCurrentUser();
    if (!user) return { error: "Unauthorized", tags: [] };

    try {
        const userTags = await db
            .select({
                id: tags.id,
                name: tags.name,
                colour: tags.colour,
            })
            .from(tags)
            .where(
                and(
                    eq(tags.userId, user.id),
                    isNull(tags.deletedAt)
                )
            )
            .orderBy(asc(tags.name));

        return { success: true, tags: userTags };
    } catch (error) {
        console.error("Failed to fetch all user tags:", error);
        return { error: "Failed to fetch user tags", tags: [] };
    }
}

export async function recordFocusSession(
    taskId: string,
    startedAt: Date,
    endedAt: Date,
    minutes: number,
    interruptions: number
) {
    const user = await getCurrentUser();
    if (!user) return { error: "Unauthorized" };

    try {
        const start = startedAt instanceof Date ? startedAt : new Date(startedAt);
        const end = endedAt instanceof Date ? endedAt : new Date(endedAt);

        // 1. Insert row into focus_sessions
        const [session] = await db
            .insert(focusSessions)
            .values({
                userId: user.id,
                taskId: taskId || null,
                startedAt: start,
                endedAt: end,
                minutes,
                interruptions,
            })
            .returning();

        // 2. Increment actualMinutes on the corresponding task
        if (taskId) {
            await db
                .update(tasks)
                .set({
                    actualMinutes: sql`COALESCE(${tasks.actualMinutes}, 0) + ${minutes}`,
                    updatedAt: new Date(),
                })
                .where(and(eq(tasks.id, taskId), eq(tasks.userId, user.id)));
        }

        revalidatePath("/");
        revalidatePath("/tasks");
        return { success: true, session };
    } catch (error) {
        console.error("Failed to record focus session:", error);
        return { error: "Failed to record focus session" };
    }
}

export async function fetchActiveMilestones() {
    const user = await getCurrentUser();
    if (!user) return { error: "Unauthorized", milestones: [] };

    try {
        const userMilestones = await db
            .select({
                id: milestones.id,
                title: milestones.title,
                dueDate: milestones.dueDate,
                completedAt: milestones.completedAt,
                stageTitle: stages.title,
                goalTitle: goals.title,
                goalId: goals.id,
            })
            .from(milestones)
            .innerJoin(stages, eq(milestones.stageId, stages.id))
            .innerJoin(roadmaps, eq(stages.roadmapId, roadmaps.id))
            .innerJoin(goals, eq(roadmaps.goalId, goals.id))
            .where(
                and(
                    eq(milestones.userId, user.id),
                    isNull(milestones.deletedAt),
                    isNull(stages.deletedAt),
                    isNull(roadmaps.deletedAt),
                    isNull(goals.deletedAt)
                )
            )
            .orderBy(asc(milestones.dueDate), asc(milestones.createdAt));

        return { success: true, milestones: userMilestones };
    } catch (error) {
        console.error("Failed to fetch active milestones:", error);
        return { error: "Failed to fetch active milestones", milestones: [] };
    }
}


