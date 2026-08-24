"use server";

import { db } from "@/server/db";
import { tasks } from "@/server/db/schema";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function createTask(formData: FormData) {
    const title = formData.get("title") as string;

    if (!title || title.trim() === "") {
        return { error: "Task title cannot be empty." };
    }

    // Get the authenticated user
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { error: "You must be logged in to create a task." };
    }

    try {
        // Insert the task into Postgres via Drizzle
        await db.insert(tasks).values({
            userId: user.id,
            title: title.trim(),
            status: "next",
        });

        // Tell Next.js to refresh the data on the Today page
        revalidatePath("/");

        return { success: true };
    } catch (error) {
        console.error("Failed to create task:", error);
        return { error: "Failed to save the task to the database." };
    }
}