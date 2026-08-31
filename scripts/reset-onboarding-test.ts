import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { db } from "../src/server/db";
import { users, tasks, goals, courses, habits, coachingNudges } from "../src/server/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  console.log("Connecting to database to reset user for Onboarding testing...");

  const user = await db.select().from(users).limit(1).then((rows) => rows[0]);
  if (!user) {
    console.error("No user found in database.");
    process.exit(1);
  }

  console.log(`Found user: ${user.email} (${user.id})`);

  // Clear tasks, goals, courses to simulate a fresh first-run user
  await db.delete(tasks).where(eq(tasks.userId, user.id));
  await db.delete(goals).where(eq(goals.userId, user.id));
  await db.delete(courses).where(eq(courses.userId, user.id));
  await db.delete(coachingNudges).where(eq(coachingNudges.userId, user.id));

  // Reset onboarding_state to empty object
  await db
    .update(users)
    .set({
      onboardingState: {},
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  console.log("✅ Successfully reset user data and onboarding state!");
  console.log("👉 Now refresh http://localhost:3000/ to see the first-run Onboarding Prompts!");
  process.exit(0);
}

main();
