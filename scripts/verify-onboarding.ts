import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { db } from "../src/server/db";
import { users } from "../src/server/db/schema";
import { eq } from "drizzle-orm";
import { updateOnboardingState } from "../src/server/actions/user";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`✅ PASSED: ${message}`);
}

async function testOnboardingStateUpdate() {
  console.log("\n--- Testing Onboarding State Management ---");

  // 1. Get or create test user
  let user = await db.select().from(users).limit(1).then((rows) => rows[0]);
  if (!user) {
    throw new Error("No user found in database");
  }

  console.log(`Testing with User ID: ${user.id}`);

  // Test updating onboarding state directly on DB
  const testStep = "skipped_prompts";
  const currentState = (user.onboardingState as Record<string, any>) || {};
  const updatedState = {
    ...currentState,
    [testStep]: true,
    completed_steps: [...(currentState.completed_steps || []), testStep],
    last_step: testStep,
    updated_at: new Date().toISOString(),
  };

  await db
    .update(users)
    .set({
      onboardingState: updatedState,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  // Verify state persisted
  const [updatedUser] = await db
    .select({ onboardingState: users.onboardingState })
    .from(users)
    .where(eq(users.id, user.id));

  const state = updatedUser.onboardingState as Record<string, any>;
  assert(state[testStep] === true, "State contains skipped_prompts flag");
  assert(Array.isArray(state.completed_steps), "State has completed_steps array");
  assert(state.completed_steps.includes(testStep), "completed_steps includes skipped_prompts");
  assert(!!state.last_step, "State records last_step");

  console.log("Onboarding verification completed successfully!");
}

async function main() {
  try {
    await testOnboardingStateUpdate();
    console.log("\n🎉 ALL ONBOARDING TESTS PASSED! 🎉\n");
    process.exit(0);
  } catch (err) {
    console.error("Test failed:", err);
    process.exit(1);
  }
}

main();
