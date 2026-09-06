"use server";

import { db } from "@/server/db";
import { habits, habitLogs, habitPauses } from "@/server/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { getCurrentUser } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { format, subDays, addDays, parseISO } from "date-fns";

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
        revalidatePath("/habits");
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
            revalidatePath("/habits");
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
            revalidatePath("/habits");
            return { success: true, checked: true, log: insertedLog };
        }
    } catch (error) {
        console.error("Failed to toggle habit check-in:", error);
        return { error: "Failed to toggle habit check-in" };
    }
}

export interface PauseHabitInput {
    habitId: string;
    startOn: string; // YYYY-MM-DD
    endOn?: string | null; // YYYY-MM-DD
    reason?: string | null;
}

export async function pauseHabit(input: PauseHabitInput) {
    const user = await getCurrentUser();
    if (!user) {
        return { error: "Unauthorized" };
    }

    try {
        const [pause] = await db
            .insert(habitPauses)
            .values({
                userId: user.id,
                habitId: input.habitId,
                startOn: input.startOn,
                endOn: input.endOn || null,
                reason: input.reason || null,
            })
            .returning();

        revalidatePath("/");
        revalidatePath("/habits");
        return { success: true, pause };
    } catch (error) {
        console.error("Failed to pause habit:", error);
        return { error: "Failed to pause habit" };
    }
}

export async function resumeHabit(pauseId: string) {
    const user = await getCurrentUser();
    if (!user) {
        return { error: "Unauthorized" };
    }

    try {
        await db
            .delete(habitPauses)
            .where(and(eq(habitPauses.id, pauseId), eq(habitPauses.userId, user.id)));

        revalidatePath("/");
        revalidatePath("/habits");
        return { success: true };
    } catch (error) {
        console.error("Failed to resume habit:", error);
        return { error: "Failed to resume habit" };
    }
}

export async function getActiveHabitPauses(habitId?: string) {
    const user = await getCurrentUser();
    if (!user) {
        return [];
    }

    try {
        const conditions = [
            eq(habitPauses.userId, user.id),
            isNull(habitPauses.deletedAt),
        ];
        if (habitId) {
            conditions.push(eq(habitPauses.habitId, habitId));
        }

        const pauses = await db
            .select()
            .from(habitPauses)
            .where(and(...conditions))
            .orderBy(desc(habitPauses.startOn));

        return pauses;
    } catch (error) {
        console.error("Failed to fetch habit pauses:", error);
        return [];
    }
}

export interface HabitStreakResult {
    currentStreak: number;
    bestStreak: number;
    isPaused: boolean;
    activePause?: typeof habitPauses.$inferSelect | null;
}

export async function calculateHabitStreak(
    habitId: string,
    asOfDate?: string
): Promise<HabitStreakResult> {
    const todayStr = asOfDate || format(new Date(), "yyyy-MM-dd");

    // Fetch habit details
    const [habit] = await db
        .select()
        .from(habits)
        .where(eq(habits.id, habitId))
        .limit(1);

    if (!habit) {
        return { currentStreak: 0, bestStreak: 0, isPaused: false, activePause: null };
    }

    // Fetch all pauses for this habit
    const pauses = await db
        .select()
        .from(habitPauses)
        .where(
            and(
                eq(habitPauses.habitId, habitId),
                isNull(habitPauses.deletedAt)
            )
        )
        .orderBy(desc(habitPauses.startOn));

    // Helper to check if a date is within any pause range
    const getPauseForDate = (dateStr: string) => {
        return pauses.find((p) => {
            if (p.startOn <= dateStr) {
                if (!p.endOn || p.endOn >= dateStr) {
                    return true;
                }
            }
            return false;
        });
    };

    const isDateInPause = (dateStr: string) => !!getPauseForDate(dateStr);

    const activePause = getPauseForDate(todayStr) || null;
    const isPaused = !!activePause;

    // Fetch all logs for this habit
    const logs = await db
        .select()
        .from(habitLogs)
        .where(
            and(
                eq(habitLogs.habitId, habitId),
                isNull(habitLogs.deletedAt)
            )
        )
        .orderBy(desc(habitLogs.loggedOn));

    const loggedDates = new Set(logs.map((l) => l.loggedOn));

    // Calculate current streak:
    // If today is logged, count it and go backwards.
    // If today is not logged:
    //   - If today falls within an active habit_pauses range, do not mark streak as broken!
    //     Streak continues backwards without counting today as a break.
    //   - If today is not in a pause range, today is ongoing (not finished), so if yesterday was logged/paused,
    //     streak is still intact. But if yesterday wasn't logged/paused, streak is 0.
    let currentStreak = 0;
    let checkDate = parseISO(todayStr);

    const isTodayLogged = loggedDates.has(todayStr);
    const isTodayPaused = isDateInPause(todayStr);

    if (isTodayLogged) {
        currentStreak++;
        checkDate = subDays(checkDate, 1);
    } else if (isTodayPaused) {
        // Today is paused: per requirement, do not mark streak as broken!
        // Start scanning backward from yesterday.
        checkDate = subDays(checkDate, 1);
    } else {
        // Today is not logged and not paused: check if yesterday was logged or paused
        const yesterdayStr = format(subDays(checkDate, 1), "yyyy-MM-dd");
        if (loggedDates.has(yesterdayStr) || isDateInPause(yesterdayStr)) {
            // Streak is alive from yesterday, scan backward starting from yesterday
            checkDate = subDays(checkDate, 1);
        } else {
            // Neither today nor yesterday was logged or paused: streak is 0
            checkDate = subDays(checkDate, 1);
        }
    }

    // Now scan backwards day by day
    let lookback = 365;
    while (lookback > 0) {
        lookback--;
        const dateStr = format(checkDate, "yyyy-MM-dd");

        if (loggedDates.has(dateStr)) {
            currentStreak++;
            checkDate = subDays(checkDate, 1);
        } else if (isDateInPause(dateStr)) {
            // In pause range: does NOT break the streak
            checkDate = subDays(checkDate, 1);
        } else {
            // Day was missed and not paused -> Streak is broken
            break;
        }
    }

    // Calculate best streak historically
    let bestStreak = currentStreak;
    if (logs.length > 0) {
        const sortedLogDates = Array.from(loggedDates).sort();
        const earliestDate = parseISO(sortedLogDates[0]);
        const latestDate = parseISO(todayStr);

        let runningStreak = 0;
        let iterDate = earliestDate;

        while (iterDate <= latestDate) {
            const dStr = format(iterDate, "yyyy-MM-dd");
            if (loggedDates.has(dStr)) {
                runningStreak++;
                if (runningStreak > bestStreak) {
                    bestStreak = runningStreak;
                }
            } else if (isDateInPause(dStr)) {
                // Paused days preserve runningStreak
            } else {
                runningStreak = 0;
            }
            iterDate = addDays(iterDate, 1);
        }
    }

    return {
        currentStreak,
        bestStreak,
        isPaused,
        activePause: activePause || null,
    };
}

export async function getHabitsWithStreaks() {
    const user = await getCurrentUser();
    if (!user) return [];

    const userHabits = await db
        .select()
        .from(habits)
        .where(and(eq(habits.userId, user.id), isNull(habits.deletedAt)))
        .orderBy(desc(habits.createdAt));

    const todayStr = format(new Date(), "yyyy-MM-dd");

    const habitsWithStreaks = await Promise.all(
        userHabits.map(async (h) => {
            const streakInfo = await calculateHabitStreak(h.id, todayStr);
            return {
                ...h,
                streak: streakInfo.currentStreak,
                bestStreak: streakInfo.bestStreak,
                isPaused: streakInfo.isPaused,
                activePause: streakInfo.activePause,
            };
        })
    );

    return habitsWithStreaks;
}

