import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { client } from "../src/server/db";

async function check() {
  const rows = await client`SELECT id, title, page_count, extracted_chars, index_status, url, created_at FROM course_resources ORDER BY created_at DESC LIMIT 5`;
  console.log("Recent resources:", rows);
  for (const r of rows) {
    const chunkCount = await client`SELECT count(*) FROM chunks WHERE entity_id = ${r.id}`;
    console.log(`Resource ${r.title} chunks count:`, chunkCount[0].count);
  }
  process.exit(0);
}

check().catch((e) => {
  console.error(e);
  process.exit(1);
});
