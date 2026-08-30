"use server";

import { db } from "@/server/db";
import { goals, roadmaps, stages, milestones } from "@/server/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getCurrentUser } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { generateNodeEmbedding } from "@/lib/embeddings";

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

        // Generate embedding for new goal
        if (insertedGoal) {
            const goalText = [cleanTitle, description, lifeArea].filter(Boolean).join(" - ");
            await generateNodeEmbedding(insertedGoal.id, goalText);
        }

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
    title: string = "Roadmap",
    description?: string,
    generatedBy: string = "manual"
) {
    const user = await getCurrentUser();
    if (!user) {
        return { error: "Unauthorized" };
    }

    const cleanTitle = title.trim() || "Roadmap";

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

export async function createStage(
    roadmapId: string,
    title: string,
    goalId?: string
) {
    const user = await getCurrentUser();
    if (!user) {
        return { error: "Unauthorized" };
    }

    const cleanTitle = title.trim();
    if (!cleanTitle) {
        return { error: "Stage title is required" };
    }

    try {
        // Find current max ordinal
        const [latestStage] = await db
            .select({ ordinal: stages.ordinal })
            .from(stages)
            .where(and(eq(stages.roadmapId, roadmapId), eq(stages.userId, user.id)))
            .orderBy(desc(stages.ordinal))
            .limit(1);

        const nextOrdinal = (latestStage?.ordinal ?? -1) + 1;

        const [insertedStage] = await db
            .insert(stages)
            .values({
                userId: user.id,
                roadmapId,
                title: cleanTitle,
                ordinal: nextOrdinal,
                targetStart: new Date(),
                status: "active",
            })
            .returning();

        if (goalId) {
            revalidatePath(`/plan/goals/${goalId}`);
        } else {
            // Find goalId via roadmap
            const [roadmap] = await db
                .select({ goalId: roadmaps.goalId })
                .from(roadmaps)
                .where(eq(roadmaps.id, roadmapId))
                .limit(1);
            if (roadmap?.goalId) {
                revalidatePath(`/plan/goals/${roadmap.goalId}`);
            }
        }
        revalidatePath("/plan/goals");

        return { success: true, stage: insertedStage };
    } catch (error) {
        console.error("Failed to create stage:", error);
        return { error: "Failed to create stage" };
    }
}

export async function createMilestone(
    stageId: string,
    title: string,
    goalId?: string
) {
    const user = await getCurrentUser();
    if (!user) {
        return { error: "Unauthorized" };
    }

    const cleanTitle = title.trim();
    if (!cleanTitle) {
        return { error: "Milestone title is required" };
    }

    try {
        // Find current max ordinal in stage
        const [latestMilestone] = await db
            .select({ ordinal: milestones.ordinal })
            .from(milestones)
            .where(and(eq(milestones.stageId, stageId), eq(milestones.userId, user.id)))
            .orderBy(desc(milestones.ordinal))
            .limit(1);

        const nextOrdinal = (latestMilestone?.ordinal ?? -1) + 1;

        const [insertedMilestone] = await db
            .insert(milestones)
            .values({
                userId: user.id,
                stageId,
                title: cleanTitle,
                ordinal: nextOrdinal,
                statusOverride: "pending",
            })
            .returning();

        if (goalId) {
            revalidatePath(`/plan/goals/${goalId}`);
        }
        revalidatePath("/plan/goals");

        return { success: true, milestone: insertedMilestone };
    } catch (error) {
        console.error("Failed to create milestone:", error);
        return { error: "Failed to create milestone" };
    }
}

export async function toggleMilestone(
    milestoneId: string,
    currentCompletedAt: Date | null | string,
    goalId?: string
) {
    const user = await getCurrentUser();
    if (!user) {
        return { error: "Unauthorized" };
    }

    try {
        const isCurrentlyCompleted = !!currentCompletedAt;
        const newCompletedAt = isCurrentlyCompleted ? null : new Date();
        const newStatus = isCurrentlyCompleted ? "pending" : "done";

        const [updatedMilestone] = await db
            .update(milestones)
            .set({
                completedAt: newCompletedAt,
                statusOverride: newStatus,
                updatedAt: new Date(),
            })
            .where(and(eq(milestones.id, milestoneId), eq(milestones.userId, user.id)))
            .returning();

        if (goalId) {
            revalidatePath(`/plan/goals/${goalId}`);
        }
        revalidatePath("/plan/goals");

        return { success: true, milestone: updatedMilestone };
    } catch (error) {
        console.error("Failed to toggle milestone:", error);
        return { error: "Failed to toggle milestone" };
    }
}
