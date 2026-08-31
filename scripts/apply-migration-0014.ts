import postgres from "postgres";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is missing");
  process.exit(1);
}

async function main() {
  console.log("Connecting to Postgres...");
  const sql = postgres(connectionString!, { max: 1 });

  try {
    const migrationPath = path.join(process.cwd(), "supabase", "migrations", "0014_phase4_extensions.sql");
    const migrationSql = fs.readFileSync(migrationPath, "utf8");
    console.log("Running migration 0014_phase4_extensions.sql...");
    await sql.unsafe(migrationSql);
    console.log("Migration 0014_phase4_extensions.sql completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
