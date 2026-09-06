import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { db } from "../src/server/db";
import { courseResources, chunks } from "../src/server/db/schema";
import { eq, inArray } from "drizzle-orm";
import { reindexResource } from "../src/server/actions/indexing";

async function run() {
  const ids = [
    "fc8e672b-5320-4d78-bfea-a789b5fa8409", // Uninformed_Search_Completed
    "1632cd2c-06bd-485c-b42d-17442e429826", // Executive Summary (1)
  ];

  console.log("=== RE-INDEXING USER RESOURCES WITH FAST BATCH EMBEDDINGS ===\n");

  for (const id of ids) {
    const [res] = await db
      .select()
      .from(courseResources)
      .where(eq(courseResources.id, id))
      .limit(1);

    if (!res) {
      console.log(`Resource ${id} not found in DB`);
      continue;
    }

    console.log(`\nRe-indexing: "${res.title}" (${id})...`);
    console.log(`URL: ${res.url}`);
    const start = Date.now();

    const result = await reindexResource(id);
    const elapsedSec = ((Date.now() - start) / 1000).toFixed(1);

    console.log(`✓ Completed in ${elapsedSec}s! Result:`, result);

    // Verify DB state
    const [updated] = await db
      .select()
      .from(courseResources)
      .where(eq(courseResources.id, id));

    const chunkRows = await db
      .select({ count: chunks.id })
      .from(chunks)
      .where(eq(chunks.entityId, id));

    console.log(`  indexStatus: ${updated.indexStatus}`);
    console.log(`  pageCount: ${updated.pageCount}`);
    console.log(`  extractedChars: ${updated.extractedChars}`);
    console.log(`  chunks stored: ${chunkRows.length}`);
  }

  console.log("\n=== ALL RE-INDEXING COMPLETE ===");
  process.exit(0);
}

run().catch((e) => {
  console.error("Re-indexing failed:", e);
  process.exit(1);
});
