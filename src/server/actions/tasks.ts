"use server";

import * as chrono from "chrono-node";
import { db } from "@/server/db";
import { tasks, tags, nodeTags, nodes } from "@/server/db/schema";
import { eq, and, asc, isNull, sql } from "drizzle-orm";
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

export async function updateTask(id: string, data: { title?: string; notes?: string }) {
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
        const newStatus = currentStatus === "done" ? "next" : "done";

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
