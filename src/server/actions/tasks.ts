"use server";

import * as chrono from "chrono-node";
import { db } from "@/server/db";
import { tasks } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function createTask(formData: FormData) {
    const rawTitle = formData.get("title") as string;

    if (!rawTitle || rawTitle.trim() === "") {
        return;
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return;
    }

    const parsed = chrono.parse(rawTitle);
    let dueAt: Date | null = null;
    let title = rawTitle.trim();

    if (parsed.length > 0) {
        dueAt = parsed[0].start.date();
        const cleaned = title.replace(parsed[0].text, "").replace(/\s+/g, " ").trim();
        if (cleaned.length > 0) {
            title = cleaned;
        }
    }

    try {
        await db.insert(tasks).values({
            userId: user.id,
            title,
            status: "next",
            dueAt,
        });

        revalidatePath("/");
        revalidatePath("/tasks");
    } catch (error) {
        console.error("Failed to create task:", error);
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