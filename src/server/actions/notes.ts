"use server";

import { db } from "@/server/db";
import { notes, nodeLinks, nodes, chunks } from "@/server/db/schema";
import { eq, and, or } from "drizzle-orm";
import { getCurrentUser } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { generateNodeEmbedding } from "@/lib/embeddings";

export async function createNote() {
    const user = await getCurrentUser();
    if (!user) {
        return { error: "Unauthorized" };
    }

    try {
        const [insertedNote] = await db
            .insert(notes)
            .values({
                userId: user.id,
                title: "Untitled Note",
                content: "",
            })
            .returning();

        revalidatePath("/notes");
        revalidatePath("/");
        return { success: true, id: insertedNote.id, note: insertedNote };
    } catch (error) {
        console.error("Failed to create note:", error);
        return { error: "Failed to create note" };
    }
}

export async function updateNote(
    id: string,
    data: {
        title?: string;
        content?: string;
    }
) {
    const user = await getCurrentUser();
    if (!user) {
        return { error: "Unauthorized" };
    }

    try {
        const [updatedNote] = await db
            .update(notes)
            .set({
                ...data,
                updatedAt: new Date(),
            })
            .where(and(eq(notes.id, id), eq(notes.userId, user.id)))
            .returning();

        // Generate embedding after DB write (awaiting as per spec preference)
        if (updatedNote && (data.title !== undefined || data.content !== undefined)) {
            const noteText = [data.title ?? updatedNote.title, data.content ?? updatedNote.content]
                .filter(Boolean)
                .join("\n\n");
            await generateNodeEmbedding(id, noteText);
        }

        revalidatePath("/notes");
        revalidatePath(`/notes/${id}`);
        return { success: true, note: updatedNote };
    } catch (error) {
        console.error("Failed to update note:", error);
        return { error: "Failed to update note" };
    }
}

export async function deleteNote(id: string) {
    const user = await getCurrentUser();
    if (!user) {
        return { error: "Unauthorized" };
    }

    try {
        const [deletedNote] = await db
            .update(notes)
            .set({
                deletedAt: new Date(),
                updatedAt: new Date(),
            })
            .where(and(eq(notes.id, id), eq(notes.userId, user.id)))
            .returning();

        if (!deletedNote) {
            return { error: "Note not found" };
        }

        // 1. Soft-delete linked node_links
        await db
            .update(nodeLinks)
            .set({
                deletedAt: new Date(),
                updatedAt: new Date(),
            })
            .where(
                or(
                    eq(nodeLinks.sourceNodeId, id),
                    eq(nodeLinks.targetNodeId, id)
                )
            );

        // 2. Delete any vector chunks associated with this note
        await db
            .delete(chunks)
            .where(
                and(
                    eq(chunks.entityType, "note"),
                    eq(chunks.entityId, id),
                    eq(chunks.userId, user.id)
                )
            );

        // 3. Mark node entry as archived in nodes table
        await db
            .update(nodes)
            .set({
                archivedAt: new Date(),
            })
            .where(and(eq(nodes.id, id), eq(nodes.userId, user.id)));

        revalidatePath("/notes");
        revalidatePath(`/notes/${id}`);
        revalidatePath("/");
        return { success: true, note: deletedNote };
    } catch (error) {
        console.error("Failed to delete note:", error);
        return { error: "Failed to delete note" };
    }
}
