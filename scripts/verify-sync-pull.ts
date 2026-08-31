import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { db } from "../src/server/db";
import { users, tasks, notes, syncOps } from "../src/server/db/schema";
import { eq, and, gt, isNull, isNotNull } from "drizzle-orm";
import { parseHlc, generateHlc } from "../src/server/sync/merge";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`✅ PASSED: ${message}`);
}

async function testPullSyncLogic() {
  console.log("\n--- Testing Pull Sync Delta & Tombstone Engine ---");

  // 1. Get user
  const user = await db.select().from(users).limit(1).then((rows) => rows[0]);
  if (!user) {
    throw new Error("No user found in database");
  }
  console.log(`Testing with User ID: ${user.id}`);

  // Base timestamp before inserting test data
  const baseTime = Date.now() - 1000;
  const sinceHlc = `${baseTime}:0:server`;

  // 2. Create Active Task A (created/updated after baseTime)
  const taskAId = crypto.randomUUID();
  await db.insert(tasks).values({
    id: taskAId,
    userId: user.id,
    title: "Pull Sync Active Task A",
    status: "inbox",
    priority: 1,
    updatedAt: new Date(),
  });

  // 3. Create Note B (created/updated after baseTime)
  const noteBId = crypto.randomUUID();
  await db.insert(notes).values({
    id: noteBId,
    userId: user.id,
    title: "Pull Sync Active Note B",
    content: "Pull sync test content",
    updatedAt: new Date(),
  });

  // 4. Create Soft-Deleted Task C (Tombstone)
  const taskCId = crypto.randomUUID();
  await db.insert(tasks).values({
    id: taskCId,
    userId: user.id,
    title: "Pull Sync Deleted Task C",
    status: "done",
    deletedAt: new Date(),
    updatedAt: new Date(),
  });

  // 5. Query Active Rows modified since `sinceHlc`
  const parsedHlc = parseHlc(sinceHlc);
  const sinceDate = new Date(parsedHlc.wallMs);

  const activeTasks = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, user.id),
        isNull(tasks.deletedAt),
        gt(tasks.updatedAt, sinceDate)
      )
    );

  const foundTaskA = activeTasks.find((t) => t.id === taskAId);
  const foundTaskCInActive = activeTasks.find((t) => t.id === taskCId);

  assert(!!foundTaskA, "Active Task A found in delta query");
  assert(!foundTaskCInActive, "Deleted Task C excluded from active query");

  // 6. Query Tombstones
  const deletedTasks = await db
    .select({ id: tasks.id, deletedAt: tasks.deletedAt })
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, user.id),
        isNotNull(tasks.deletedAt),
        gt(tasks.deletedAt, sinceDate)
      )
    );

  const foundTaskCInTombstones = deletedTasks.find((t) => t.id === taskCId);
  assert(!!foundTaskCInTombstones, "Deleted Task C returned in tombstones array");

  // 7. Verify cursor generation
  const cursor = generateHlc("server");
  assert(cursor.endsWith(":server"), "Cursor has server origin");
  assert(parseHlc(cursor).wallMs >= baseTime, "Cursor timestamp is monotonic");

  // 8. Cleanup test entities
  await db.delete(tasks).where(eq(tasks.id, taskAId));
  await db.delete(notes).where(eq(notes.id, noteBId));
  await db.delete(tasks).where(eq(tasks.id, taskCId));

  console.log("Pull test cleanup completed successfully!");
}

async function main() {
  try {
    await testPullSyncLogic();
    console.log("\n🎉 ALL PULL SYNC TESTS PASSED! 🎉\n");
    process.exit(0);
  } catch (err) {
    console.error("Test failed:", err);
    process.exit(1);
  }
}

main();
