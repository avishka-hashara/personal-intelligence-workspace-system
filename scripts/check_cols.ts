import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { client } from "../src/server/db";

async function check() {
  const cols = await client`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'flashcards'`;
  console.log("Flashcards columns:", cols);
  process.exit(0);
}

check().catch((e) => {
  console.error(e);
  process.exit(1);
});
