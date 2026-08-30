import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { backfillEmbeddings } from "@/lib/embeddings";

async function run() {
  console.log("Starting backfill for missing embeddings...");
  const startTime = Date.now();
  const result = await backfillEmbeddings();
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`Backfill completed in ${elapsed}s! Processed: ${result.done}, Failed: ${result.failed}`);
  process.exit(result.failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("Backfill failed with unhandled error:", err);
  process.exit(1);
});
