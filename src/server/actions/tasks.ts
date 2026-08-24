"use server";

import { db } from "@/server/db";
import { tasks } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function createTask(formData: FormData) {
    const title = formData.get("title") as string;

    if (!title || title.trim() === "") {
        return { error: "Task title cannot be empty." };
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { error: "You must be logged in to create a task." };
    }

    try {
        await db.insert(tasks).values({
            userId: user.id,
            title: title.trim(),
            status: "next",
        });

        revalidatePath("/");
        revalidatePath("/tasks");

        return { success: true };
    } catch (error) {
        console.error("Failed to create task:", error);
        return { error: "Failed to save the task." };
    }
}

export async function toggleTaskStatus(id: string, currentStatus: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const newStatus = currentStatus === "done" ? "next" : "done";
    const completedAt = newStatus === "done" ? new Date() : null; // We'll just use updated_at for now, but this prepares us for future logic

    await db.update(tasks)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(and(eq(tasks.id, id), eq(tasks.userId, user.id)));

    revalidatePath("/");
    revalidatePath("/tasks");
}

export async function deleteTask(id: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    await db.delete(tasks)
        .where(and(eq(tasks.id, id), eq(tasks.userId, user.id)));

    revalidatePath("/");
    revalidatePath("/tasks");
}