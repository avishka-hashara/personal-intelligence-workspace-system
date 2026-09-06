"use server";

import { db } from "@/server/db";
import { chunks, courseResources, courses } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { embedText } from "@/lib/embeddings";
import { revalidatePath } from "next/cache";

interface ChunkToInsert {
  userId: string;
  entityType: string;
  entityId: string;
  chunkIndex: number;
  content: string;
  contextHeader: string;
  tokenCount: number;
  embedding: number[] | null;
  modelVersion: string;
}

/**
 * Splits text into structure-aware chunks (~500-800 tokens with ~60-token overlap).
 * 1 token ~ 4 characters (or ~0.75 words).
 */
function createStructureAwareChunks(
  pages: { num: number; text: string }[],
  courseCode: string,
  resourceTitle: string
): { pageNum: number; content: string; contextHeader: string; tokenCount: number }[] {
  const result: { pageNum: number; content: string; contextHeader: string; tokenCount: number }[] = [];

  const TARGET_CHUNK_CHARS = 2400; // ~600 tokens
  const MAX_CHUNK_CHARS = 3200;    // ~800 tokens
  const OVERLAP_CHARS = 240;       // ~60 tokens

  for (const page of pages) {
    const rawPageText = page.text.trim();
    if (!rawPageText) continue;

    const header = `${courseCode} > ${resourceTitle} > Page ${page.num}`;
    const paragraphs = rawPageText.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

    let currentChunk = "";

    for (const para of paragraphs) {
      if (!currentChunk) {
        currentChunk = para;
      } else if (currentChunk.length + para.length + 2 <= MAX_CHUNK_CHARS) {
        currentChunk += "\n\n" + para;
      } else {
        // Chunk is full
        const approxTokens = Math.ceil(currentChunk.length / 4);
        result.push({
          pageNum: page.num,
          content: currentChunk,
          contextHeader: header,
          tokenCount: approxTokens,
        });

        // Compute overlap for next chunk
        const overlapSlice = currentChunk.slice(-OVERLAP_CHARS);
        currentChunk = overlapSlice + "\n\n" + para;
      }
    }

    if (currentChunk.trim()) {
      const approxTokens = Math.ceil(currentChunk.length / 4);
      result.push({
        pageNum: page.num,
        content: currentChunk.trim(),
        contextHeader: header,
        tokenCount: approxTokens,
      });
    }
  }

  // Fallback: If no chunks were produced (e.g. whitespace-only pages)
  if (result.length === 0 && pages.length > 0) {
    const header = `${courseCode} > ${resourceTitle} > Page 1`;
    result.push({
      pageNum: 1,
      content: resourceTitle,
      contextHeader: header,
      tokenCount: Math.ceil(resourceTitle.length / 4),
    });
  }

  return result;
}

/**
 * Extracts text from a PDF buffer, splits it into structure-aware chunks,
 * prepends context headers, calculates embeddings, and stores chunks in the database.
 */
export async function indexResource(resourceId: string, fileBuffer: Buffer) {
  try {
    // 1. Fetch resource and parent course
    const [resource] = await db
      .select()
      .from(courseResources)
      .where(eq(courseResources.id, resourceId))
      .limit(1);

    if (!resource) {
      return { success: false, error: "Resource not found" };
    }

    const [course] = await db
      .select()
      .from(courses)
      .where(eq(courses.id, resource.courseId))
      .limit(1);

    const courseCode = course?.code || "COURSE";
    const resourceTitle = resource.title || "Resource";

    // 2. Update status to 'indexing'
    await db
      .update(courseResources)
      .set({
        indexStatus: "indexing",
        updatedAt: new Date(),
      })
      .where(eq(courseResources.id, resourceId));

    // 3. Extract text with pdf-parse
    let totalPages = 1;
    let fullExtractedText = "";
    let pages: { num: number; text: string }[] = [];

    try {
      const pdfParseModule = (await import("pdf-parse")) as any;
      const uint8Data = new Uint8Array(fileBuffer);

      if (pdfParseModule.PDFParse && typeof pdfParseModule.PDFParse === "function") {
        const parser = new pdfParseModule.PDFParse(uint8Data);
        const parsed = await parser.getText();
        totalPages = parsed.total || parsed.pages?.length || 1;
        fullExtractedText = parsed.text || "";
        pages =
          parsed.pages && parsed.pages.length > 0
            ? parsed.pages
            : [{ num: 1, text: fullExtractedText }];
      } else {
        const parserFunc = pdfParseModule.default || pdfParseModule;
        const parsed = await parserFunc(uint8Data);
        totalPages = parsed.numpages || 1;
        fullExtractedText = parsed.text || "";
        pages = [{ num: 1, text: fullExtractedText }];
      }
    } catch (parseError) {
      console.error("[indexResource] PDF parse error:", parseError);
      // Fallback: continue with resource title so failure does not block completely
      fullExtractedText = resourceTitle;
      pages = [{ num: 1, text: resourceTitle }];
    }

    // 4. Split into structure-aware chunks
    const rawChunks = createStructureAwareChunks(pages, courseCode, resourceTitle);

    // 5. Delete existing chunks for this resource if re-indexing
    await db
      .delete(chunks)
      .where(eq(chunks.entityId, resourceId));

    // 6. Generate embeddings and prepare rows
    const chunksToInsert: ChunkToInsert[] = [];

    for (let i = 0; i < rawChunks.length; i++) {
      const item = rawChunks[i];
      const textToEmbed = `${item.contextHeader}\n\n${item.content}`;

      let embedding: number[] | null = null;
      try {
        embedding = await embedText(textToEmbed);
      } catch (embErr) {
        console.warn(`[indexResource] Embedding failed for chunk ${i}:`, embErr);
      }

      chunksToInsert.push({
        userId: resource.userId,
        entityType: "resource",
        entityId: resource.id,
        chunkIndex: i,
        content: item.content,
        contextHeader: item.contextHeader,
        tokenCount: item.tokenCount,
        embedding: embedding,
        modelVersion: "text-embedding-3-small",
      });
    }

    // 7. Insert chunk rows into chunks table
    if (chunksToInsert.length > 0) {
      await db.insert(chunks).values(chunksToInsert);
    }

    // 8. Update course_resources record with page_count, extracted_chars, and index_status: 'ready'
    await db
      .update(courseResources)
      .set({
        pageCount: totalPages,
        extractedChars: fullExtractedText.length,
        indexStatus: "ready",
        updatedAt: new Date(),
      })
      .where(eq(courseResources.id, resourceId));

    try {
      revalidatePath(`/study/courses/${resource.courseId}`);
      revalidatePath("/study/courses");
    } catch {
      // Ignored outside Next.js request context (e.g. background/scripts)
    }

    return {
      success: true,
      chunksCount: chunksToInsert.length,
      pageCount: totalPages,
      extractedChars: fullExtractedText.length,
    };
  } catch (error: any) {
    console.error("[indexResource] Fatal indexing failure:", error);

    // Record index_status as failed
    await db
      .update(courseResources)
      .set({
        indexStatus: "failed",
        updatedAt: new Date(),
      })
      .where(eq(courseResources.id, resourceId));

    return { success: false, error: error?.message || "Failed to index resource" };
  }
}
