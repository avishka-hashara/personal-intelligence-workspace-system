import { embed, embedMany } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { db } from "@/server/db";
import { nodes, notes, goals, courses, tasks } from "@/server/db/schema";
import { eq, isNull, and, inArray } from "drizzle-orm";
import crypto from "crypto";

/**
 * CRITICAL ARCHITECTURAL NOTE:
 * The embedding model text-embedding-3-small produces vectors of exactly 1536 dimensions.
 * If this model is ever changed or upgraded, the vector dimension in src/server/db/schema.ts
 * and supabase/migrations must be changed in lockstep, and every existing row must be re-embedded.
 */
export const EMBEDDING_MODEL_ID =
  process.env.EMBEDDING_MODEL ||
  (process.env.OPENROUTER_API_KEY && !process.env.OPENAI_API_KEY
    ? "openai/text-embedding-3-small"
    : "text-embedding-3-small");

const openaiProvider = createOpenAI({
  baseURL:
    process.env.OPENAI_BASE_URL ||
    (process.env.OPENROUTER_API_KEY && !process.env.OPENAI_API_KEY
      ? "https://openrouter.ai/api/v1"
      : undefined),
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY || "",
  headers: {
    "HTTP-Referer": "http://localhost:3000",
    "X-Title": "Personal Intelligence Workspace",
  },
});

function getEmbeddingModel() {
  return openaiProvider.embedding(EMBEDDING_MODEL_ID);
}

/**
 * Normalizes whitespace and truncates text to roughly 8,000 tokens (~32,000 chars).
 */
export function normalizeAndTruncate(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  // ~8000 tokens limit safely estimated as 32000 chars
  if (normalized.length > 32000) {
    return normalized.slice(0, 32000);
  }
  return normalized;
}

/**
 * Computes SHA-256 hash of normalized text for staleness/deduplication checks.
 */
export function computeEmbeddingHash(text: string): string {
  const normalized = normalizeAndTruncate(text);
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

/**
 * Sleep helper for exponential backoff.
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Embeds a single string of text.
 * Retries twice on 429/5xx with exponential backoff.
 * Throws on final failure.
 */
export async function embedText(text: string): Promise<number[]> {
  const cleaned = normalizeAndTruncate(text);
  if (!cleaned) {
    throw new Error("Cannot embed empty text");
  }

  const model = getEmbeddingModel();
  const maxRetries = 2;
  let attempt = 0;
  let lastError: any = null;

  while (attempt <= maxRetries) {
    try {
      const { embedding } = await embed({
        model,
        value: cleaned,
      });
      return embedding;
    } catch (error: any) {
      lastError = error;
      attempt++;

      const status = error?.status || error?.statusCode || error?.response?.status;
      const isRetryable =
        status === 429 ||
        (typeof status === "number" && status >= 500 && status < 600) ||
        error?.message?.includes("429") ||
        error?.message?.includes("500") ||
        error?.message?.includes("502") ||
        error?.message?.includes("503") ||
        error?.message?.includes("504") ||
        error?.message?.includes("rate limit") ||
        error?.message?.includes("timeout");

      if (attempt <= maxRetries && isRetryable) {
        const backoffMs = Math.pow(2, attempt - 1) * 500; // 500ms, 1000ms
        console.warn(
          `[embedText] Embedding failed with status ${status}, retrying in ${backoffMs}ms (attempt ${attempt}/${maxRetries})...`
        );
        await delay(backoffMs);
      } else {
        break;
      }
    }
  }

  console.error("[embedText] Embedding failed after retries:", lastError);
  throw lastError;
}

/**
 * Generates and stores the embedding for a given node.
 * 1. Hashes normalized text.
 * 2. Compares hash with database to return early if unchanged.
 * 3. Sets embedding = NULL if text is empty.
 * 4. Generates embedding and updates nodes table.
 * 5. NEVER throws into calling mutations (logs error and returns).
 */
export async function generateNodeEmbedding(nodeId: string, text: string): Promise<void> {
  try {
    const normalized = normalizeAndTruncate(text);
    const hash = crypto.createHash("sha256").update(normalized).digest("hex");

    // 1. Read existing node's embedding hash
    const [existingNode] = await db
      .select({
        id: nodes.id,
        embeddingHash: nodes.embeddingHash,
      })
      .from(nodes)
      .where(eq(nodes.id, nodeId))
      .limit(1);

    if (!existingNode) {
      console.warn(`[generateNodeEmbedding] Node not found: ${nodeId}`);
      return;
    }

    // 2. If hash matches, RETURN EARLY — no API call (cost control)
    if (existingNode.embeddingHash === hash) {
      return;
    }

    // 3. If text is empty/whitespace, clear embedding and return
    if (!normalized) {
      await db
        .update(nodes)
        .set({
          embedding: null,
          embeddingHash: null,
          embeddedAt: null,
          snippet: null,
        })
        .where(eq(nodes.id, nodeId));
      return;
    }

    // 4. Generate embedding and update node
    const vec = await embedText(normalized);
    const snippet = normalized.slice(0, 300);

    await db
      .update(nodes)
      .set({
        embedding: vec,
        embeddingHash: hash,
        embeddedAt: new Date(),
        snippet: snippet,
      })
      .where(eq(nodes.id, nodeId));
  } catch (error) {
    // NEVER throw into the save path — note save must succeed even when embedding provider is down
    console.error(`[generateNodeEmbedding] Failed to generate embedding for node ${nodeId}:`, error);
  }
}

/**
 * Resolves content text for a list of node records based on their entity type.
 */
async function resolveNodeTexts(
  nodeList: { id: string; entityType: string; title: string | null; snippet: string | null }[]
): Promise<Map<string, string>> {
  const textMap = new Map<string, string>();
  const notesIds: string[] = [];
  const goalsIds: string[] = [];
  const coursesIds: string[] = [];
  const tasksIds: string[] = [];

  for (const n of nodeList) {
    if (n.entityType === "notes") notesIds.push(n.id);
    else if (n.entityType === "goals") goalsIds.push(n.id);
    else if (n.entityType === "courses") coursesIds.push(n.id);
    else if (n.entityType === "tasks") tasksIds.push(n.id);
    else {
      textMap.set(n.id, [n.title, n.snippet].filter(Boolean).join(" - "));
    }
  }

  const [notesRows, goalsRows, coursesRows, tasksRows] = await Promise.all([
    notesIds.length > 0
      ? db
          .select({ id: notes.id, title: notes.title, content: notes.content })
          .from(notes)
          .where(inArray(notes.id, notesIds))
      : Promise.resolve([]),
    goalsIds.length > 0
      ? db
          .select({
            id: goals.id,
            title: goals.title,
            description: goals.description,
            lifeArea: goals.lifeArea,
          })
          .from(goals)
          .where(inArray(goals.id, goalsIds))
      : Promise.resolve([]),
    coursesIds.length > 0
      ? db
          .select({
            id: courses.id,
            code: courses.code,
            title: courses.title,
            instructor: courses.instructor,
            term: courses.term,
          })
          .from(courses)
          .where(inArray(courses.id, coursesIds))
      : Promise.resolve([]),
    tasksIds.length > 0
      ? db
          .select({ id: tasks.id, title: tasks.title, notes: tasks.notes })
          .from(tasks)
          .where(inArray(tasks.id, tasksIds))
      : Promise.resolve([]),
  ]);

  for (const row of notesRows) {
    textMap.set(row.id, [row.title, row.content].filter(Boolean).join("\n\n"));
  }
  for (const row of goalsRows) {
    textMap.set(row.id, [row.title, row.description, row.lifeArea].filter(Boolean).join(" - "));
  }
  for (const row of coursesRows) {
    textMap.set(row.id, [row.code, row.title, row.instructor, row.term].filter(Boolean).join(" - "));
  }
  for (const row of tasksRows) {
    textMap.set(row.id, [row.title, row.notes].filter(Boolean).join(" - "));
  }

  // Fallback for any nodes not matched in typed tables
  for (const n of nodeList) {
    if (!textMap.has(n.id)) {
      textMap.set(n.id, [n.title, n.snippet].filter(Boolean).join(" - "));
    }
  }

  return textMap;
}

/**
 * Backfills embeddings for all nodes where embedding IS NULL.
 * Batches of 50 via embedMany. Idempotent and resumable.
 */
export async function backfillEmbeddings(
  userId?: string
): Promise<{ done: number; failed: number }> {
  let done = 0;
  let failed = 0;

  const model = getEmbeddingModel();
  const BATCH_SIZE = 50;

  while (true) {
    const conditions = [isNull(nodes.embedding)];
    if (userId) {
      conditions.push(eq(nodes.userId, userId));
    }

    const batchNodes = await db
      .select({
        id: nodes.id,
        entityType: nodes.entityType,
        title: nodes.title,
        snippet: nodes.snippet,
        embeddingHash: nodes.embeddingHash,
      })
      .from(nodes)
      .where(and(...conditions))
      .limit(BATCH_SIZE);

    if (batchNodes.length === 0) {
      break;
    }

    const textMap = await resolveNodeTexts(batchNodes);

    const itemsToEmbed: { node: (typeof batchNodes)[0]; text: string; hash: string }[] = [];

    for (const node of batchNodes) {
      const rawText = textMap.get(node.id) || "";
      const normalized = normalizeAndTruncate(rawText);

      if (!normalized) {
        // Empty text: update hash to empty and leave embedding null so it's not repeatedly queried
        await db
          .update(nodes)
          .set({
            embedding: null,
            embeddingHash: crypto.createHash("sha256").update("").digest("hex"),
            embeddedAt: new Date(),
          })
          .where(eq(nodes.id, node.id));
        done++;
        continue;
      }

      const hash = crypto.createHash("sha256").update(normalized).digest("hex");
      itemsToEmbed.push({ node, text: normalized, hash });
    }

    if (itemsToEmbed.length > 0) {
      try {
        const values = itemsToEmbed.map((item) => item.text);
        const { embeddings } = await embedMany({
          model,
          values,
        });

        for (let i = 0; i < itemsToEmbed.length; i++) {
          const item = itemsToEmbed[i];
          const vec = embeddings[i];
          const snippet = item.text.slice(0, 300);

          await db
            .update(nodes)
            .set({
              embedding: vec,
              embeddingHash: item.hash,
              embeddedAt: new Date(),
              snippet: snippet,
            })
            .where(eq(nodes.id, item.node.id));

          done++;
        }
      } catch (error) {
        console.error("[backfillEmbeddings] Batch embedding failure:", error);
        failed += itemsToEmbed.length;
        // Break out of loop on fatal failure to prevent infinite loops
        break;
      }
    }
  }

  return { done, failed };
}
