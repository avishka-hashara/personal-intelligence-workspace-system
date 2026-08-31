import { db } from "../src/server/db";
import {
  users,
  accounts,
  transactions,
  budgets,
  subscriptions,
  metricDefinitions,
  metricLogs,
} from "../src/server/db/schema";
import { eq, and, isNull, gte, desc } from "drizzle-orm";
import * as dotenv from "dotenv";
import { subDays, format } from "date-fns";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

async function main() {
  console.log("=== Starting Phase 4 Extensions Verification ===");

  // 1. Fetch or create a test user
  let [testUser] = await db.select().from(users).limit(1);
  if (!testUser) {
    console.log("Creating dummy user for verification...");
    [testUser] = await db
      .insert(users)
      .values({
        email: "phase4_test@example.com",
        displayName: "Phase 4 Tester",
      })
      .returning();
  }

  const userId = testUser.id;
  console.log(`Using Test User ID: ${userId} (${testUser.email})`);

  // -------------------------------------------------------------
  // Test 1: Finance - Accounts
  // -------------------------------------------------------------
  console.log("\n[Test 1] Testing Accounts...");
  const [createdAccount] = await db
    .insert(accounts)
    .values({
      userId,
      name: "Test Sapphire Checking",
      type: "checking",
    })
    .returning();
  console.log("✓ Account created:", createdAccount.id, createdAccount.name);

  // -------------------------------------------------------------
  // Test 2: Finance - Budgets
  // -------------------------------------------------------------
  console.log("\n[Test 2] Testing Budgets...");
  const [createdBudget] = await db
    .insert(budgets)
    .values({
      userId,
      category: "Groceries",
      monthlyLimit: "600",
    })
    .returning();
  console.log("✓ Budget created:", createdBudget.id, `${createdBudget.category} -> $${createdBudget.monthlyLimit}`);

  // -------------------------------------------------------------
  // Test 3: Finance - Transactions
  // -------------------------------------------------------------
  console.log("\n[Test 3] Testing Transactions...");
  const [createdTx] = await db
    .insert(transactions)
    .values({
      userId,
      accountId: createdAccount.id,
      amount: "85.50",
      date: new Date(),
      category: "Groceries",
      description: "Weekly supermarket run",
    })
    .returning();
  console.log("✓ Transaction created:", createdTx.id, `$${createdTx.amount} for ${createdTx.category}`);

  // -------------------------------------------------------------
  // Test 4: Finance - Subscriptions
  // -------------------------------------------------------------
  console.log("\n[Test 4] Testing Subscriptions...");
  const nextMonth = new Date();
  nextMonth.setDate(nextMonth.getDate() + 15);
  const [createdSub] = await db
    .insert(subscriptions)
    .values({
      userId,
      name: "Spotify Premium",
      amount: "10.99",
      renewalDate: nextMonth,
      cycle: "monthly",
    })
    .returning();
  console.log("✓ Subscription created:", createdSub.id, `${createdSub.name} ($${createdSub.amount}/${createdSub.cycle})`);

  // -------------------------------------------------------------
  // Test 5: Health - Metric Definitions
  // -------------------------------------------------------------
  console.log("\n[Test 5] Testing Metric Definitions...");
  const [metricSleep] = await db
    .insert(metricDefinitions)
    .values({
      userId,
      name: "Sleep",
      unit: "hours",
    })
    .returning();

  const [metricWater] = await db
    .insert(metricDefinitions)
    .values({
      userId,
      name: "Water",
      unit: "litres",
    })
    .returning();
  console.log("✓ Metric definitions created:", metricSleep.name, `(${metricSleep.unit}),`, metricWater.name, `(${metricWater.unit})`);

  // -------------------------------------------------------------
  // Test 6: Health - Metric Logs (14-Day Simulation)
  // -------------------------------------------------------------
  console.log("\n[Test 6] Testing Metric Logs (Multi-day time series)...");
  const logEntries = [];
  for (let i = 0; i < 7; i++) {
    const dayStr = format(subDays(new Date(), i), "yyyy-MM-dd");
    logEntries.push({
      userId,
      metricId: metricSleep.id,
      loggedOn: dayStr,
      value: (7.0 + (i % 3) * 0.5).toString(),
    });
    logEntries.push({
      userId,
      metricId: metricWater.id,
      loggedOn: dayStr,
      value: (2.0 + (i % 2) * 0.5).toString(),
    });
  }

  const insertedLogs = await db.insert(metricLogs).values(logEntries).returning();
  console.log(`✓ Inserted ${insertedLogs.length} metric log entries over the past 7 days.`);

  // -------------------------------------------------------------
  // Test 7: Queries & Relations Verification
  // -------------------------------------------------------------
  console.log("\n[Test 7] Verifying Joined Queries...");
  
  // Finance join
  const joinedTxs = await db
    .select({
      id: transactions.id,
      amount: transactions.amount,
      category: transactions.category,
      accountName: accounts.name,
    })
    .from(transactions)
    .leftJoin(accounts, eq(transactions.accountId, accounts.id))
    .where(eq(transactions.id, createdTx.id));
  
  if (joinedTxs.length === 1 && joinedTxs[0].accountName === createdAccount.name) {
    console.log("✓ Transaction + Account join successful:", joinedTxs[0]);
  } else {
    throw new Error("Transaction join failed");
  }

  // Health join
  const joinedLogs = await db
    .select({
      id: metricLogs.id,
      loggedOn: metricLogs.loggedOn,
      value: metricLogs.value,
      metricName: metricDefinitions.name,
      metricUnit: metricDefinitions.unit,
    })
    .from(metricLogs)
    .innerJoin(metricDefinitions, eq(metricLogs.metricId, metricDefinitions.id))
    .where(and(eq(metricLogs.userId, userId), isNull(metricLogs.deletedAt)))
    .orderBy(desc(metricLogs.loggedOn));

  console.log(`✓ Queried ${joinedLogs.length} joined health logs. Sample:`, joinedLogs[0]);

  // -------------------------------------------------------------
  // Cleanup Test Data
  // -------------------------------------------------------------
  console.log("\n[Test 8] Cleaning up created test entities...");
  await db.delete(metricLogs).where(eq(metricLogs.userId, userId));
  await db.delete(metricDefinitions).where(eq(metricDefinitions.userId, userId));
  await db.delete(subscriptions).where(eq(subscriptions.userId, userId));
  await db.delete(transactions).where(eq(transactions.userId, userId));
  await db.delete(budgets).where(eq(budgets.userId, userId));
  await db.delete(accounts).where(eq(accounts.userId, userId));
  console.log("✓ Cleanup finished.");

  console.log("\n🎉 ALL PHASE 4 EXTENSION TESTS PASSED SUCCESSFULLY! 🎉");
  process.exit(0);
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
