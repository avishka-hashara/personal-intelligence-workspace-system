"use server";

import { db } from "@/server/db";
import { habits, habitLogs } from "@/server/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { getCurrentUser } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export interface CreateHabitInput {
    title: string;
    cadence?: string;
    rrule?: string | null;
    targetCount?: number;
    unit?: string | null;
    gracePerWeek?: number;
    active?: boolean;
    colour?: string | null;
}

export async function createHabit(input: FormData | CreateHabitInput) {
    const user = await getCurrentUser();
    if (!user) {
        return { error: "Unauthorized" };
    }

    let title = "";
    let cadence = "daily";
    let rrule: string | null = null;
    let targetCount = 1;
    let unit: string | null = null;
    let gracePerWeek = 0;
    let active = true;
    let colour: string | null = null;

    if (input instanceof FormData) {
        title = (input.get("title") as string) || "";
        cadence = (input.get("cadence") as string) || "daily";
        rrule = (input.get("rrule") as string) || null;
        const targetCountVal = input.get("targetCount") as string | null;
        if (targetCountVal) targetCount = parseInt(targetCountVal, 10) || 1;
        unit = (input.get("unit") as string) || null;
        const graceVal = input.get("gracePerWeek") as string | null;
        if (graceVal) gracePerWeek = parseInt(graceVal, 10) || 0;
        const activeVal = input.get("active") as string | null;
        if (activeVal !== null) active = activeVal === "true" || activeVal === "on";
        colour = (input.get("colour") as string) || null;
    } else {
        title = input.title;
        if (input.cadence) cadence = input.cadence;
        if (input.rrule !== undefined) rrule = input.rrule;
        if (input.targetCount !== undefined) targetCount = input.targetCount;
        if (input.unit !== undefined) unit = input.unit;
        if (input.gracePerWeek !== undefined) gracePerWeek = input.gracePerWeek;
        if (input.active !== undefined) active = input.active;
        if (input.colour !== undefined) colour = input.colour;
    }

    const cleanTitle = title.trim();
    if (!cleanTitle) {
        return { error: "Habit title is required" };
    }

    try {
        const [insertedHabit] = await db
            .insert(habits)
            .values({
                userId: user.id,
                title: cleanTitle,
                cadence,
                rrule,
                targetCount,
                unit,
                gracePerWeek,
                active,
                colour,
            })
            .returning();

        revalidatePath("/");
        return { success: true, habit: insertedHabit };
    } catch (error) {
        console.error("Failed to create habit:", error);
        return { error: "Failed to create habit" };
    }
}

export async function toggleHabitCheckIn(habitId: string, dateStr: string) {
    const user = await getCurrentUser();
    if (!user) {
        return { error: "Unauthorized" };
    }

    try {
        // Check if log exists for this user, habit, and date
        const [existingLog] = await db
            .select()
            .from(habitLogs)
            .where(
                and(
                    eq(habitLogs.userId, user.id),
                    eq(habitLogs.habitId, habitId),
                    eq(habitLogs.loggedOn, dateStr),
                    isNull(habitLogs.deletedAt)
                )
            )
            .limit(1);

        if (existingLog) {
            // Un-check: Delete the log row
            await db
                .delete(habitLogs)
                .where(eq(habitLogs.id, existingLog.id));

            revalidatePath("/");
            return { success: true, checked: false };
        } else {
            // Check-in: Insert new log row
            const todayStr = new Date().toISOString().split("T")[0];
            const isBackfilled = dateStr < todayStr;

            const [insertedLog] = await db
                .insert(habitLogs)
                .values({
                    userId: user.id,
                    habitId,
                    loggedOn: dateStr,
                    value: "1",
                    backfilled: isBackfilled,
                })
                .returning();

            revalidatePath("/");
            return { success: true, checked: true, log: insertedLog };
        }
    } catch (error) {
        console.error("Failed to toggle habit check-in:", error);
        return { error: "Failed to toggle habit check-in" };
    }
}
