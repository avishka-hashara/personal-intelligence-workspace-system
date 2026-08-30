"use server";

import { db } from "@/server/db";
import { goals, roadmaps, stages, milestones, milestoneDependencies, vMilestoneStatus } from "@/server/db/schema";
import { eq, and, desc, inArray, isNull } from "drizzle-orm";
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

        // If trying to complete, verify no incomplete predecessors exist
        if (!isCurrentlyCompleted) {
            const incompleteDeps = await db
                .select({ title: milestones.title })
                .from(milestoneDependencies)
                .innerJoin(milestones, eq(milestoneDependencies.predecessorId, milestones.id))
                .where(
                    and(
                        eq(milestoneDependencies.successorId, milestoneId),
                        isNull(milestones.completedAt),
                        isNull(milestones.deletedAt)
                    )
                );

            if (incompleteDeps.length > 0) {
                const depNames = incompleteDeps.map((d) => `"${d.title}"`).join(", ");
                return {
                    error: `Cannot complete this milestone: it is blocked by incomplete dependency ${depNames}. Complete dependencies first!`,
                };
            }
        }

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

export async function updateMilestoneDueDate(
    milestoneId: string,
    dueDate: Date | string | null,
    goalId?: string
) {
    const user = await getCurrentUser();
    if (!user) {
        return { error: "Unauthorized" };
    }

    try {
        const parsedDate = dueDate ? (typeof dueDate === "string" ? new Date(dueDate) : dueDate) : null;

        const [updatedMilestone] = await db
            .update(milestones)
            .set({
                dueDate: parsedDate,
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
        console.error("Failed to update milestone due date:", error);
        return { error: "Failed to update milestone due date" };
    }
}

export async function addMilestoneDependency(
    predecessorId: string,
    successorId: string,
    goalId?: string
) {
    const user = await getCurrentUser();
    if (!user) {
        return { error: "Unauthorized" };
    }

    if (!predecessorId || !successorId) {
        return { error: "Both predecessor and successor are required" };
    }

    if (predecessorId === successorId) {
        return { error: "A milestone cannot depend on itself" };
    }

    try {
        // 1. Verify user ownership of both milestones
        const ownedMilestones = await db
            .select({ id: milestones.id })
            .from(milestones)
            .where(
                and(
                    inArray(milestones.id, [predecessorId, successorId]),
                    eq(milestones.userId, user.id),
                    isNull(milestones.deletedAt)
                )
            );

        if (ownedMilestones.length < 2) {
            return { error: "One or both milestones not found" };
        }

        // 2. Fetch all existing dependencies for user's milestones to check for cycles
        const allUserMilestones = await db
            .select({ id: milestones.id })
            .from(milestones)
            .where(and(eq(milestones.userId, user.id), isNull(milestones.deletedAt)));

        const allUserMilestoneIds = allUserMilestones.map((m) => m.id);

        const existingDeps = allUserMilestoneIds.length > 0
            ? await db
                .select({
                    predecessorId: milestoneDependencies.predecessorId,
                    successorId: milestoneDependencies.successorId,
                })
                .from(milestoneDependencies)
                .where(inArray(milestoneDependencies.predecessorId, allUserMilestoneIds))
            : [];

        // Build adjacency list: node -> outgoing successors
        const graph = new Map<string, string[]>();
        for (const dep of existingDeps) {
            const list = graph.get(dep.predecessorId) || [];
            list.push(dep.successorId);
            graph.set(dep.predecessorId, list);
        }

        // Check if successorId can reach predecessorId (which would mean adding predecessorId -> successorId creates a cycle)
        const visited = new Set<string>();
        const queue: string[] = [successorId];
        let createsCycle = false;

        while (queue.length > 0) {
            const current = queue.shift()!;
            if (current === predecessorId) {
                createsCycle = true;
                break;
            }
            if (!visited.has(current)) {
                visited.add(current);
                const nextNodes = graph.get(current) || [];
                for (const next of nextNodes) {
                    if (!visited.has(next)) {
                        queue.push(next);
                    }
                }
            }
        }

        if (createsCycle) {
            return { error: "Cycle detected: cannot create dependency loop" };
        }

        // 3. Insert dependency
        await db
            .insert(milestoneDependencies)
            .values({
                predecessorId,
                successorId,
                kind: "fs",
            })
            .onConflictDoNothing();

        if (goalId) {
            revalidatePath(`/plan/goals/${goalId}`);
        }
        revalidatePath("/plan/goals");

        return { success: true };
    } catch (error: any) {
        console.error("Failed to add milestone dependency:", error);
        return { error: error?.message || "Failed to add milestone dependency" };
    }
}

export async function removeMilestoneDependency(
    predecessorId: string,
    successorId: string,
    goalId?: string
) {
    const user = await getCurrentUser();
    if (!user) {
        return { error: "Unauthorized" };
    }

    try {
        await db
            .delete(milestoneDependencies)
            .where(
                and(
                    eq(milestoneDependencies.predecessorId, predecessorId),
                    eq(milestoneDependencies.successorId, successorId)
                )
            );

        if (goalId) {
            revalidatePath(`/plan/goals/${goalId}`);
        }
        revalidatePath("/plan/goals");

        return { success: true };
    } catch (error) {
        console.error("Failed to remove milestone dependency:", error);
        return { error: "Failed to remove milestone dependency" };
    }
}

export async function getMilestoneDependencies(goalId?: string) {
    const user = await getCurrentUser();
    if (!user) {
        return { dependencies: [] };
    }

    try {
        const deps = await db
            .select({
                predecessorId: milestoneDependencies.predecessorId,
                successorId: milestoneDependencies.successorId,
                kind: milestoneDependencies.kind,
            })
            .from(milestoneDependencies)
            .innerJoin(milestones, eq(milestoneDependencies.predecessorId, milestones.id))
            .where(and(eq(milestones.userId, user.id), isNull(milestones.deletedAt)));

        return { dependencies: deps };
    } catch (error) {
        console.error("Failed to fetch milestone dependencies:", error);
        return { dependencies: [] };
    }
}

/**
 * Deterministic Fallback: Shifts a milestone and all its downstream transitive successors by N days.
 */
export async function shiftDownstreamMilestones(
    milestoneId: string,
    days: number,
    goalId?: string
) {
    const user = await getCurrentUser();
    if (!user) {
        return { error: "Unauthorized" };
    }

    if (!days || isNaN(days)) {
        return { error: "Valid number of days required" };
    }

    try {
        // 1. Fetch all user milestones & dependencies
        const userMilestones = await db
            .select()
            .from(milestones)
            .where(and(eq(milestones.userId, user.id), isNull(milestones.deletedAt)));

        const milestoneMap = new Map(userMilestones.map((m) => [m.id, m]));
        const target = milestoneMap.get(milestoneId);
        if (!target) {
            return { error: "Target milestone not found" };
        }

        const userMilestoneIds = userMilestones.map((m) => m.id);
        const deps = userMilestoneIds.length > 0
            ? await db
                .select({
                    predecessorId: milestoneDependencies.predecessorId,
                    successorId: milestoneDependencies.successorId,
                })
                .from(milestoneDependencies)
                .where(inArray(milestoneDependencies.predecessorId, userMilestoneIds))
            : [];

        // Build adjacency list for downstream traversal
        const graph = new Map<string, string[]>();
        for (const d of deps) {
            const list = graph.get(d.predecessorId) || [];
            list.push(d.successorId);
            graph.set(d.predecessorId, list);
        }

        // Find all transitive downstream successors (including starting milestone)
        const downstreamIds = new Set<string>();
        const queue: string[] = [milestoneId];

        while (queue.length > 0) {
            const current = queue.shift()!;
            if (!downstreamIds.has(current)) {
                downstreamIds.add(current);
                const nexts = graph.get(current) || [];
                for (const n of nexts) {
                    if (!downstreamIds.has(n)) {
                        queue.push(n);
                    }
                }
            }
        }

        const msToAdd = days * 24 * 60 * 60 * 1000;
        const updatedMilestonesList: (typeof milestones.$inferSelect)[] = [];

        // Apply shift to all downstream milestones with a due date
        for (const id of downstreamIds) {
            const m = milestoneMap.get(id);
            if (m && m.dueDate) {
                const currentDueDate = new Date(m.dueDate);
                const newDueDate = new Date(currentDueDate.getTime() + msToAdd);

                const [updated] = await db
                    .update(milestones)
                    .set({
                        dueDate: newDueDate,
                        updatedAt: new Date(),
                    })
                    .where(and(eq(milestones.id, id), eq(milestones.userId, user.id)))
                    .returning();

                if (updated) {
                    updatedMilestonesList.push(updated);
                }
            }
        }

        if (goalId) {
            revalidatePath(`/plan/goals/${goalId}`);
        }
        revalidatePath("/plan/goals");

        return {
            success: true,
            shiftedCount: updatedMilestonesList.length,
            milestones: updatedMilestonesList,
        };
    } catch (error: any) {
        console.error("Failed to shift downstream milestones:", error);
        return { error: error?.message || "Failed to shift downstream milestones" };
    }
}

/**
 * Applies AI-09 proposed date adjustments across milestones.
 */
export async function applyReplan(
    milestoneUpdates: { milestone_id: string; new_date: string; reason?: string }[],
    goalId?: string
) {
    const user = await getCurrentUser();
    if (!user) {
        return { error: "Unauthorized" };
    }

    if (!Array.isArray(milestoneUpdates) || milestoneUpdates.length === 0) {
        return { error: "No milestone updates provided" };
    }

    try {
        const updatedResults: (typeof milestones.$inferSelect)[] = [];

        for (const item of milestoneUpdates) {
            if (!item.milestone_id || !item.new_date) continue;
            const parsedDate = new Date(item.new_date);
            if (isNaN(parsedDate.getTime())) continue;

            const [updated] = await db
                .update(milestones)
                .set({
                    dueDate: parsedDate,
                    updatedAt: new Date(),
                })
                .where(and(eq(milestones.id, item.milestone_id), eq(milestones.userId, user.id)))
                .returning();

            if (updated) {
                updatedResults.push(updated);
            }
        }

        if (goalId) {
            revalidatePath(`/plan/goals/${goalId}`);
        }
        revalidatePath("/plan/goals");

        return {
            success: true,
            appliedCount: updatedResults.length,
            milestones: updatedResults,
        };
    } catch (error: any) {
        console.error("Failed to apply replan:", error);
        return { error: error?.message || "Failed to apply replan" };
    }
}
