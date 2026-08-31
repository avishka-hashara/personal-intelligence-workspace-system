import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { client } from "../src/server/db";
import * as fs from "fs";
import * as path from "path";

async function run() {
  const migrationPath = path.join(process.cwd(), "supabase", "migrations", "0012_coaching_nudges.sql");
  const sqlContent = fs.readFileSync(migrationPath, "utf8");
  console.log("Applying migration 0012_coaching_nudges.sql...");
  await client.unsafe(sqlContent);
  console.log("Migration 0012 applied successfully!");
  
  const cols = await client`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'coaching_nudges'`;
  console.log("Coaching nudges columns:", cols.map((c: any) => `${c.column_name} (${c.data_type})`));
  process.exit(0);
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
