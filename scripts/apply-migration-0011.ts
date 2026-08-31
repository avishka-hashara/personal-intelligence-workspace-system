import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { client } from "../src/server/db";
import * as fs from "fs";
import * as path from "path";

async function run() {
  const migrationPath = path.join(process.cwd(), "supabase", "migrations", "0011_flashcard_fsrs.sql");
  const sqlContent = fs.readFileSync(migrationPath, "utf8");
  console.log("Applying migration 0011_flashcard_fsrs.sql...");
  await client.unsafe(sqlContent);
  console.log("Migration 0011 applied successfully!");
  
  const cols = await client`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'flashcards'`;
  console.log("Updated flashcards columns:", cols.map((c: any) => c.column_name));
  process.exit(0);
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
