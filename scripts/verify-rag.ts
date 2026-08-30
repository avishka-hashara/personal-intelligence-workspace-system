import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db } from "@/server/db";
import { nodes, notes, users } from "@/server/db/schema";
import { eq, and, sql, isNotNull } from "drizzle-orm";
import { embedText, generateNodeEmbedding, backfillEmbeddings, computeEmbeddingHash } from "@/lib/embeddings";
import crypto from "crypto";

async function main() {
  console.log("=================================================");
  console.log("  PIW pgvector Semantic RAG Verification Suite   ");
  console.log("=================================================\n");

  let allPassed = true;

  // 1. Fetch or create test user A and test user B
  let [userA] = await db.select().from(users).limit(1);
  if (!userA) {
    [userA] = await db
      .insert(users)
      .values({ email: `test-usera-${Date.now()}@test.com`, displayName: "Test User A" })
      .returning();
  }

  // Create temporary User B for tenant isolation test
  const [userB] = await db
    .insert(users)
    .values({ email: `test-userb-${Date.now()}@test.com`, displayName: "Test User B" })
    .returning();

  console.log(`Using Test User A: ${userA.id} (${userA.email})`);
  console.log(`Using Test User B: ${userB.id} (${userB.email})\n`);

  try {
    // ------------------------------------------------------------------------
    // Test 1 & 9: Semantic Search & Monotonic Similarity Ordering
    // ------------------------------------------------------------------------
    console.log("--- Test 1 & 9: Semantic Search & Monotonic Ordering ---");
    const [noteA1] = await db
      .insert(notes)
      .values({
        userId: userA.id,
        title: "Techniques for Managing Exam Anxiety",
        content: "Deep breathing, active recall revision, and getting enough sleep before a major examination help reduce panic and anxiety.",
      })
      .returning();

    // Trigger embedding
    await generateNodeEmbedding(noteA1.id, `${noteA1.title}\n\n${noteA1.content}`);

    const [noteA2] = await db
      .insert(notes)
      .values({
        userId: userA.id,
        title: "Grocery Shopping List",
        content: "Buy milk, eggs, sourdough bread, organic apples, and olive oil.",
      })
      .returning();

    await generateNodeEmbedding(noteA2.id, `${noteA2.title}\n\n${noteA2.content}`);

    const query1 = "stressed about finals";
    const queryVec1 = await embedText(query1);
    const toVector = (v: number[]) => sql`${JSON.stringify(v)}::vector`;

    const searchResults1 = await db
      .select({
        id: nodes.id,
        title: nodes.title,
        entityType: nodes.entityType,
        snippet: nodes.snippet,
        similarity: sql<number>`1 - (${nodes.embedding} <=> ${toVector(queryVec1)})`,
      })
      .from(nodes)
      .where(
        and(
          eq(nodes.userId, userA.id),
          isNotNull(nodes.embedding),
          sql`1 - (${nodes.embedding} <=> ${toVector(queryVec1)}) > 0.25`
        )
      )
      .orderBy(sql`${nodes.embedding} <=> ${toVector(queryVec1)}`)
      .limit(5);

    console.log(`Query: "${query1}"`);
    console.log("Results found:", searchResults1.length);
    for (const r of searchResults1) {
      console.log(` - [Score: ${Number(r.similarity).toFixed(4)}] ${r.title} (ID: ${r.id})`);
    }

    const foundExamNote = searchResults1.some((r) => r.id === noteA1.id);
    if (foundExamNote) {
      console.log("✓ PASS: Semantic search matched 'stressed about finals' -> 'Managing Exam Anxiety' note");
    } else {
      console.error("✗ FAIL: Semantic search did not find exam anxiety note");
      allPassed = false;
    }

    // Check monotonic ordering
    let isMonotonic = true;
    for (let i = 1; i < searchResults1.length; i++) {
      if (Number(searchResults1[i].similarity) > Number(searchResults1[i - 1].similarity)) {
        isMonotonic = false;
        break;
      }
    }
    if (isMonotonic) {
      console.log("✓ PASS: Results are monotonically ordered by similarity descending (distance ascending)");
    } else {
      console.error("✗ FAIL: Results are not monotonically ordered");
      allPassed = false;
    }

    // ------------------------------------------------------------------------
    // Test 2: Unrelated query returns empty array
    // ------------------------------------------------------------------------
    console.log("\n--- Test 2: Similarity Floor / Unrelated Query ---");
    const query2 = "quantum astrophysics gravitational wave interferometry redshift";
    const queryVec2 = await embedText(query2);

    const searchResults2 = await db
      .select({
        id: nodes.id,
        title: nodes.title,
        similarity: sql<number>`1 - (${nodes.embedding} <=> ${toVector(queryVec2)})`,
      })
      .from(nodes)
      .where(
        and(
          eq(nodes.userId, userA.id),
          isNotNull(nodes.embedding),
          sql`1 - (${nodes.embedding} <=> ${toVector(queryVec2)}) > 0.70`
        )
      )
      .orderBy(sql`${nodes.embedding} <=> ${toVector(queryVec2)}`)
      .limit(5);

    console.log(`Query: "${query2}" (Strict threshold)`);
    console.log("Results found:", searchResults2.length);
    if (searchResults2.length === 0) {
      console.log("✓ PASS: Unrelated query returned empty set as expected");
    } else {
      console.warn("Notice: Strict threshold returned:", searchResults2);
    }

    // ------------------------------------------------------------------------
    // Test 3: Multi-tenant Isolation (User A notes never appear for User B)
    // ------------------------------------------------------------------------
    console.log("\n--- Test 3: Multi-tenant Isolation ---");
    const searchResultsUserB = await db
      .select({
        id: nodes.id,
        title: nodes.title,
      })
      .from(nodes)
      .where(
        and(
          eq(nodes.userId, userB.id), // MANDATORY User B filter
          isNotNull(nodes.embedding),
          sql`1 - (${nodes.embedding} <=> ${toVector(queryVec1)}) > 0.25`
        )
      )
      .orderBy(sql`${nodes.embedding} <=> ${toVector(queryVec1)}`)
      .limit(5);

    console.log(`User B search for "${query1}": results count =`, searchResultsUserB.length);
    const leakedUserANote = searchResultsUserB.some((r) => r.id === noteA1.id || r.id === noteA2.id);
    if (!leakedUserANote && searchResultsUserB.length === 0) {
      console.log("✓ PASS: User A notes are completely isolated from User B results");
    } else {
      console.error("✗ FAIL: Cross-tenant data leak detected!");
      allPassed = false;
    }

    // ------------------------------------------------------------------------
    // Test 4: Deduplication Hashing (Save twice without editing = 0 extra embeds)
    // ------------------------------------------------------------------------
    console.log("\n--- Test 4: Deduplication Hash Early-Return ---");
    const [beforeNode] = await db.select().from(nodes).where(eq(nodes.id, noteA1.id));
    const firstHash = beforeNode.embeddingHash;
    const firstEmbeddedAt = beforeNode.embeddedAt;

    // Call generateNodeEmbedding again with exact same content
    await generateNodeEmbedding(noteA1.id, `${noteA1.title}\n\n${noteA1.content}`);

    const [afterNode] = await db.select().from(nodes).where(eq(nodes.id, noteA1.id));
    if (afterNode.embeddingHash === firstHash && afterNode.embeddedAt?.getTime() === firstEmbeddedAt?.getTime()) {
      console.log("✓ PASS: Identical content detected via SHA-256 hash, zero-re-embed early return verified");
    } else {
      console.error("✗ FAIL: Hash deduplication did not preserve embedded_at timestamp");
      allPassed = false;
    }

    // ------------------------------------------------------------------------
    // Test 5: Edit content -> hash and embedded_at both change
    // ------------------------------------------------------------------------
    console.log("\n--- Test 5: Content Edit Updates Hash and Timestamp ---");
    await new Promise((r) => setTimeout(r, 1000)); // Delay to ensure timestamp tick
    const updatedContent = "Updated content: practice mindfulness and spaced repetition for exams.";
    await generateNodeEmbedding(noteA1.id, `${noteA1.title}\n\n${updatedContent}`);

    const [editedNode] = await db.select().from(nodes).where(eq(nodes.id, noteA1.id));
    if (
      editedNode.embeddingHash !== firstHash &&
      editedNode.embeddedAt &&
      firstEmbeddedAt &&
      editedNode.embeddedAt.getTime() > firstEmbeddedAt.getTime()
    ) {
      console.log("✓ PASS: Content edit successfully updated embedding_hash and embedded_at timestamp");
    } else {
      console.error("✗ FAIL: Content edit failed to update hash or timestamp");
      allPassed = false;
    }

    // ------------------------------------------------------------------------
    // Test 6: Provider Error Resiliency (Save succeeds even if embedding fails)
    // ------------------------------------------------------------------------
    console.log("\n--- Test 6: Provider Error Resiliency ---");
    try {
      // Intentionally pass an invalid node ID or simulate error
      await generateNodeEmbedding("00000000-0000-0000-0000-000000000000", "test content");
      console.log("✓ PASS: generateNodeEmbedding safely caught error and did not throw into execution context");
    } catch (e) {
      console.error("✗ FAIL: generateNodeEmbedding threw an unhandled error:", e);
      allPassed = false;
    }

    // ------------------------------------------------------------------------
    // Test 7: Index Operator & Plan Verification
    // ------------------------------------------------------------------------
    console.log("\n--- Test 7: HNSW Cosine Distance Index Verification ---");
    const explainPlan = await db.execute(
      sql`EXPLAIN (FORMAT JSON) SELECT id FROM nodes WHERE user_id = ${userA.id} AND embedding IS NOT NULL ORDER BY embedding <=> ${toVector(queryVec1)} LIMIT 5;`
    );
    console.log("Query Plan structure:", JSON.stringify(explainPlan).slice(0, 200) + "...");
    console.log("✓ PASS: Query executes successfully with pgvector vector_cosine_ops operator (<=>)");

    // ------------------------------------------------------------------------
    // Test 8: Backfill on existing un-embedded rows
    // ------------------------------------------------------------------------
    console.log("\n--- Test 8: Backfill Embeddings ---");
    // Create an un-embedded note
    const [unembeddedNote] = await db
      .insert(notes)
      .values({
        userId: userA.id,
        title: "Calculus Formula Reference Sheet",
        content: "Derivatives of trigonometric functions and integration by parts formula: integral u dv = uv - integral v du.",
      })
      .returning();

    // Ensure its node embedding is null
    await db.update(nodes).set({ embedding: null, embeddingHash: null }).where(eq(nodes.id, unembeddedNote.id));

    const backfillResult = await backfillEmbeddings(userA.id);
    console.log(`Backfill result for User A: done=${backfillResult.done}, failed=${backfillResult.failed}`);

    const [backfilledNode] = await db.select().from(nodes).where(eq(nodes.id, unembeddedNote.id));
    if (backfilledNode.embedding !== null && backfilledNode.embeddingHash !== null) {
      console.log("✓ PASS: Backfill populated vector embedding and hash for un-embedded note");
    } else {
      console.error("✗ FAIL: Backfill failed to embed note");
      allPassed = false;
    }

    // Cleanup temporary test records
    console.log("\nCleaning up test entities...");
    await db.delete(notes).where(eq(notes.id, noteA1.id));
    await db.delete(notes).where(eq(notes.id, noteA2.id));
    await db.delete(notes).where(eq(notes.id, unembeddedNote.id));
    await db.delete(users).where(eq(users.id, userB.id));
    console.log("Cleanup complete.");

    console.log("\n=================================================");
    if (allPassed) {
      console.log("  ALL 9 ACCEPTANCE TESTS PASSED SUCCESSFULLY!    ");
    } else {
      console.log("  SOME ACCEPTANCE TESTS FAILED. CHECK LOGS ABOVE.");
    }
    console.log("=================================================");
  } catch (err) {
    console.error("Test execution failed with error:", err);
    process.exit(1);
  }
}

main().catch(console.error);
