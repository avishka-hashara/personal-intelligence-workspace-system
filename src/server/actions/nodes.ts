"use server";

import { db } from "@/server/db";
import { nodes, nodeLinks } from "@/server/db/schema";
import { eq, and, ne, ilike, isNull, or } from "drizzle-orm";
import { getCurrentUser } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export interface NodeSearchResult {
    id: string;
    title: string | null;
    entityType: string;
}

export interface ConnectedNode {
    id: string;
    title: string | null;
    entityType: string;
    kind: string | null;
    createdAt?: Date | null;
}

export async function searchNodes(query: string, excludeId?: string) {
    const user = await getCurrentUser();
    if (!user) {
        return { error: "Unauthorized", nodes: [] };
    }

    const trimmed = query.trim();

    try {
        // Fetch any existing linked node IDs to exclude them from the search results
        let existingLinkedIds: string[] = [];
        if (excludeId) {
            const existingLinks = await db
                .select({
                    targetId: nodeLinks.targetNodeId,
                    sourceId: nodeLinks.sourceNodeId,
                })
                .from(nodeLinks)
                .where(
                    or(
                        eq(nodeLinks.sourceNodeId, excludeId),
                        eq(nodeLinks.targetNodeId, excludeId)
                    )
                );

            existingLinkedIds = existingLinks.map((l) =>
                l.targetId === excludeId ? l.sourceId : l.targetId
            );
        }

        const baseConditions = [eq(nodes.userId, user.id)];

        if (excludeId) {
            baseConditions.push(ne(nodes.id, excludeId));
        }

        // If user typed a search query, search across all entity types with a high limit
        if (trimmed) {
            baseConditions.push(ilike(nodes.title, `%${trimmed}%`));

            const results = await db
                .select({
                    id: nodes.id,
                    title: nodes.title,
                    entityType: nodes.entityType,
                })
                .from(nodes)
                .where(and(...baseConditions))
                .limit(30);

            const filtered = results.filter((r) => !existingLinkedIds.includes(r.id));
            return { success: true, nodes: filtered };
        }

        // If search is blank (initial dropdown), fetch balanced results across each entity type
        const entityTypes = ["goals", "courses", "notes", "tasks"];
        const groupPromises = entityTypes.map((type) =>
            db
                .select({
                    id: nodes.id,
                    title: nodes.title,
                    entityType: nodes.entityType,
                })
                .from(nodes)
                .where(and(...baseConditions, eq(nodes.entityType, type)))
                .limit(8)
        );

        const groupResults = await Promise.all(groupPromises);
        const allResults = groupResults
            .flat()
            .filter((r) => !existingLinkedIds.includes(r.id));

        return { success: true, nodes: allResults };
    } catch (error) {
        console.error("Failed to search nodes:", error);
        return { error: "Failed to search nodes", nodes: [] };
    }
}

export async function addNodeLink(
    sourceId: string,
    targetId: string,
    kind: string = "reference"
) {
    const user = await getCurrentUser();
    if (!user) {
        return { error: "Unauthorized" };
    }

    if (!sourceId || !targetId || sourceId === targetId) {
        return { error: "Invalid node link IDs" };
    }

    try {
        await db
            .insert(nodeLinks)
            .values({
                sourceNodeId: sourceId,
                targetNodeId: targetId,
                kind,
            })
            .onConflictDoNothing();

        revalidatePath(`/notes/${sourceId}`);
        revalidatePath(`/notes/${targetId}`);
        revalidatePath("/notes");
        return { success: true };
    } catch (error) {
        console.error("Failed to add node link:", error);
        return { error: "Failed to add node link" };
    }
}

export async function removeNodeLink(sourceId: string, targetId: string) {
    const user = await getCurrentUser();
    if (!user) {
        return { error: "Unauthorized" };
    }

    try {
        await db
            .delete(nodeLinks)
            .where(
                or(
                    and(
                        eq(nodeLinks.sourceNodeId, sourceId),
                        eq(nodeLinks.targetNodeId, targetId)
                    ),
                    and(
                        eq(nodeLinks.sourceNodeId, targetId),
                        eq(nodeLinks.targetNodeId, sourceId)
                    )
                )
            );

        revalidatePath(`/notes/${sourceId}`);
        revalidatePath(`/notes/${targetId}`);
        revalidatePath("/notes");
        return { success: true };
    } catch (error) {
        console.error("Failed to remove node link:", error);
        return { error: "Failed to remove node link" };
    }
}

export async function getNodeConnections(nodeId: string) {
    const user = await getCurrentUser();
    if (!user) {
        return { forwardLinks: [], backlinks: [] };
    }

    try {
        // 1. Fetch forward links (Outgoing from this node)
        const forwardLinks: ConnectedNode[] = await db
            .select({
                id: nodes.id,
                title: nodes.title,
                entityType: nodes.entityType,
                kind: nodeLinks.kind,
                createdAt: nodeLinks.createdAt,
            })
            .from(nodeLinks)
            .innerJoin(nodes, eq(nodeLinks.targetNodeId, nodes.id))
            .where(
                and(
                    eq(nodeLinks.sourceNodeId, nodeId),
                    isNull(nodeLinks.deletedAt)
                )
            );

        // 2. Fetch backlinks (Incoming references pointing to this node)
        const backlinks: ConnectedNode[] = await db
            .select({
                id: nodes.id,
                title: nodes.title,
                entityType: nodes.entityType,
                kind: nodeLinks.kind,
                createdAt: nodeLinks.createdAt,
            })
            .from(nodeLinks)
            .innerJoin(nodes, eq(nodeLinks.sourceNodeId, nodes.id))
            .where(
                and(
                    eq(nodeLinks.targetNodeId, nodeId),
                    isNull(nodeLinks.deletedAt)
                )
            );

        return { forwardLinks, backlinks };
    } catch (error) {
        console.error("Failed to get node connections:", error);
        return { forwardLinks: [], backlinks: [] };
    }
}
