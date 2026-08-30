"use server";

import { db } from "@/server/db";
import { goals, roadmaps } from "@/server/db/schema";
import { getCurrentUser } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export interface CreateGoalInput {
    title: string;
    description?: string | null;
    lifeArea?: string | null;
    directionId?: string | null;
    targetDate?: Date | string | null;
    metricName?: string | null;
    targetValue?: string | null;
    currentValue?: string | null;
    unit?: string | null;
    status?: string;
    confidence?: number | null;
}

export async function createGoal(input: FormData | CreateGoalInput) {
    const user = await getCurrentUser();
    if (!user) {
        return { error: "Unauthorized" };
    }

    let title = "";
    let description: string | null = null;
    let lifeArea: string | null = null;
    let directionId: string | null = null;
    let targetDate: Date | null = null;
    let metricName: string | null = null;
    let targetValue: string | null = null;
    let currentValue: string | null = null;
    let unit: string | null = null;
    let status = "active";
    let confidence: number | null = null;

    if (input instanceof FormData) {
        title = (input.get("title") as string) || "";
        description = (input.get("description") as string) || null;
        lifeArea = (input.get("lifeArea") as string) || null;
        directionId = (input.get("directionId") as string) || null;
        const targetDateVal = input.get("targetDate") as string | null;
        if (targetDateVal) {
            targetDate = new Date(targetDateVal);
        }
        metricName = (input.get("metricName") as string) || null;
        targetValue = (input.get("targetValue") as string) || null;
        currentValue = (input.get("currentValue") as string) || null;
        unit = (input.get("unit") as string) || null;
        const statusVal = input.get("status") as string | null;
        if (statusVal) status = statusVal;
        const confidenceVal = input.get("confidence") as string | null;
        if (confidenceVal) confidence = parseInt(confidenceVal, 10);
    } else {
        title = input.title;
        description = input.description ?? null;
        lifeArea = input.lifeArea ?? null;
        directionId = input.directionId ?? null;
        if (input.targetDate) {
            targetDate = typeof input.targetDate === "string" ? new Date(input.targetDate) : input.targetDate;
        }
        metricName = input.metricName ?? null;
        targetValue = input.targetValue ?? null;
        currentValue = input.currentValue ?? null;
        unit = input.unit ?? null;
        if (input.status) status = input.status;
        if (input.confidence !== undefined) confidence = input.confidence;
    }

    const cleanTitle = title.trim();
    if (!cleanTitle) {
        return { error: "Goal title is required" };
    }

    try {
        const [insertedGoal] = await db
            .insert(goals)
            .values({
                userId: user.id,
                title: cleanTitle,
                description,
                lifeArea,
                directionId,
                targetDate,
                metricName,
                targetValue,
                currentValue,
                unit,
                status,
                confidence,
            })
            .returning();

        revalidatePath("/plan/goals");
        revalidatePath("/");
        return { success: true, goal: insertedGoal };
    } catch (error) {
        console.error("Failed to create goal:", error);
        return { error: "Failed to create goal" };
    }
}

export async function createRoadmap(
    goalId: string,
    title: string,
    description?: string,
    generatedBy: string = "manual"
) {
    const user = await getCurrentUser();
    if (!user) {
        return { error: "Unauthorized" };
    }

    const cleanTitle = title.trim();
    if (!cleanTitle) {
        return { error: "Roadmap title is required" };
    }

    try {
        const [insertedRoadmap] = await db
            .insert(roadmaps)
            .values({
                userId: user.id,
                goalId,
                title: cleanTitle,
                description: description || null,
                generatedBy,
            })
            .returning();

        revalidatePath("/plan/goals");
        revalidatePath(`/plan/goals/${goalId}`);
        return { success: true, id: insertedRoadmap.id, roadmap: insertedRoadmap };
    } catch (error) {
        console.error("Failed to create roadmap:", error);
        return { error: "Failed to create roadmap" };
    }
}
