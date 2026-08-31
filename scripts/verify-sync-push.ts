import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { db } from "../src/server/db";
import { users, tasks, notes, syncOps } from "../src/server/db/schema";
import { eq, and } from "drizzle-orm";
import {
  parseHlc,
  compareHlc,
  isHlcNewer,
  generateHlc,
  mergeEntityFields,
  type SyncOp,
} from "../src/server/sync/merge";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`✅ PASSED: ${message}`);
}

async function testHlcEngine() {
  console.log("\n--- Testing HLC Utilities ---");

  // 1. Parsing
  const parsed = parseHlc("1756012345678:4:client-abc");
  assert(parsed.wallMs === 1756012345678, "Parse HLC wallMs");
  assert(parsed.counter === 4, "Parse HLC counter");
  assert(parsed.clientId === "client-abc", "Parse HLC clientId");

  // 2. Comparison: Wall clock wins
  assert(
    compareHlc("2000000000000:0:clientA", "1000000000000:10:clientB") > 0,
    "HLC comparison: newer wall clock wins"
  );
  assert(
    compareHlc("1000000000000:0:clientA", "2000000000000:0:clientB") < 0,
    "HLC comparison: older wall clock loses"
  );

  // 3. Comparison: Logical counter wins on equal wall clock
  assert(
    compareHlc("1000000000000:5:clientA", "1000000000000:2:clientA") > 0,
    "HLC comparison: higher counter wins on equal wall clock"
  );

  // 4. Comparison: Client ID tie-breaker on identical clock & counter
  assert(
    compareHlc("1000000000000:1:clientB", "1000000000000:1:clientA") > 0,
    "HLC comparison: client ID tie-breaker works lexicographically"
  );

  // 5. isHlcNewer
  assert(isHlcNewer("2000:0:c1", "1000:0:c1"), "isHlcNewer returns true for newer");
  assert(!isHlcNewer("1000:0:c1", "2000:0:c1"), "isHlcNewer returns false for older");

  // 6. generateHlc
  const hlc1 = generateHlc("client-1");
  const hlc2 = generateHlc("client-1", hlc1);
  assert(isHlcNewer(hlc2, hlc1), "generateHlc produces strictly increasing HLC");
}

async function testFieldLevelMerge() {
  console.log("\n--- Testing Field-Level Merge Logic ---");

  // 1. New entity creation
  const createOp: SyncOp = {
    op_id: "op-1",
    hlc: "1000:0:c1",
    type: "insert",
    fields: {
      title: "Write documentation",
      status: "next",
      priority: 1,
    },
  };
  const createRes = mergeEntityFields(null, createOp);
  assert(createRes.resolution === "applied", "Create op resolution is applied");
  assert(createRes.mergedFields.title === "Write documentation", "Create op sets title");
  assert(createRes.mergedFields.status === "next", "Create op sets status");

  // 2. Scalar state LWW: Client newer
  const serverTask = {
    id: "task-123",
    title: "Old Title",
    status: "inbox",
    priority: 0,
    hlc: "1000:0:server",
    deletedAt: null,
  };

  const newerClientOp: SyncOp = {
    op_id: "op-2",
    hlc: "2000:0:client1",
    type: "update",
    fields: {
      title: "New Title",
      priority: 2,
    },
  };

  const mergeNewer = mergeEntityFields(serverTask, newerClientOp);
  assert(mergeNewer.resolution === "applied", "Newer client op is applied");
  assert(mergeNewer.mergedFields.title === "New Title", "Newer title applied");
  assert(mergeNewer.mergedFields.priority === 2, "Newer priority applied");
  assert(mergeNewer.mergedFields.status === "inbox", "Unmodified server status preserved");

  // 3. Scalar state LWW: Server newer (conflict)
  const olderClientOp: SyncOp = {
    op_id: "op-3",
    hlc: "500:0:client1",
    type: "update",
    fields: {
      title: "Stale Title",
      status: "done",
    },
  };

  const mergeOlder = mergeEntityFields(serverTask, olderClientOp);
  assert(mergeOlder.resolution === "server_wins", "Older client op resolves to server_wins");
  assert(mergeOlder.mergedFields.title === "Old Title", "Server title preserved over older client edit");
  assert(mergeOlder.mergedFields.status === "inbox", "Server status preserved over older client edit");

  // 4. Monotonic max fields: reps / lapses
  const serverFlashcard = {
    id: "card-1",
    front: "What is HLC?",
    back: "Hybrid Logical Clock",
    reps: 5,
    lapses: 1,
    hlc: "2000:0:server",
  };

  const monotonicClientOp: SyncOp = {
    op_id: "op-4",
    hlc: "1000:0:clientOffline", // Older HLC
    type: "update",
    fields: {
      reps: 8, // But higher reps
    },
  };

  const mergeMonotonic = mergeEntityFields(serverFlashcard, monotonicClientOp);
  assert(mergeMonotonic.mergedFields.reps === 8, "Monotonic reps takes higher value (8 > 5)");
  assert(mergeMonotonic.fieldWinners.reps === "client", "Client won reps field monotonically");

  // 5. Deletion vs Edit (Resurrection)
  const deletedServerTask = {
    id: "task-del",
    title: "Deleted task",
    hlc: "1000:0:server",
    deletedAt: new Date("2026-08-30T10:00:00Z"),
  };

  const resurrectOp: SyncOp = {
    op_id: "op-resurrect",
    hlc: "2000:0:client1", // Newer HLC edit
    type: "update",
    fields: {
      title: "Resurrected Task",
    },
  };

  const resurrectRes = mergeEntityFields(deletedServerTask, resurrectOp);
  assert(resurrectRes.isResurrected === true, "Task flagged as resurrected");
  assert(resurrectRes.mergedFields.deletedAt === null, "deletedAt cleared on newer edit");
}

async function testDatabaseSyncFlow() {
  console.log("\n--- Testing End-to-End Database Sync Flow ---");

  // 1. Get or create test user
  let user = await db.select().from(users).limit(1).then((rows) => rows[0]);
  if (!user) {
    console.log("Creating test user for sync verification...");
    const [newUser] = await db
      .insert(users)
      .values({
        email: "sync_tester@test.com",
        displayName: "Sync Tester",
      })
      .returning();
    user = newUser;
  }

  console.log(`Using user ID: ${user.id}`);

  const testEntityId = crypto.randomUUID();
  const opId1 = crypto.randomUUID();
  const clientId = "device-test-1";

  // Simulate Push Op 1: Insert Task
  const op1: SyncOp = {
    op_id: opId1,
    client_id: clientId,
    entity_type: "tasks",
    entity_id: testEntityId,
    type: "insert",
    hlc: "1000000000000:0:device-test-1",
    fields: {
      title: "Sync Test Task",
      status: "next",
      priority: 2,
    },
  };

  // Insert entity
  const merge1 = mergeEntityFields(null, op1);
  await db.insert(tasks).values({
    id: testEntityId,
    userId: user.id,
    title: merge1.mergedFields.title,
    status: merge1.mergedFields.status,
    priority: merge1.mergedFields.priority,
    hlc: op1.hlc,
  });

  // Record in sync_ops
  await db.insert(syncOps).values({
    opId: opId1,
    clientId: clientId,
    entityType: "tasks",
    entityId: testEntityId,
    op: op1,
    hlc: op1.hlc,
  });

  console.log("Op 1 applied: Task inserted & recorded in sync_ops.");

  // Simulate Op 2: Idempotent Replay
  const existingOp = await db
    .select({ opId: syncOps.opId })
    .from(syncOps)
    .where(eq(syncOps.opId, opId1))
    .limit(1);

  assert(existingOp.length > 0, "Idempotency check: Op 1 correctly found in sync_ops");

  // Simulate Op 3: Concurrent edit with Newer HLC
  const opId3 = crypto.randomUUID();
  const op3: SyncOp = {
    op_id: opId3,
    client_id: "device-test-2",
    entity_type: "tasks",
    entity_id: testEntityId,
    type: "update",
    hlc: "2000000000000:0:device-test-2",
    fields: {
      status: "done",
      notes: "Completed via offline sync",
    },
  };

  const [currentTask] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, testEntityId), eq(tasks.userId, user.id)));

  const merge3 = mergeEntityFields(currentTask, op3);
  assert(merge3.resolution === "applied", "Op 3 resolution is applied");
  assert(merge3.mergedFields.status === "done", "Status updated to done");
  assert(merge3.mergedFields.title === "Sync Test Task", "Original title preserved");

  await db
    .update(tasks)
    .set({
      status: merge3.mergedFields.status,
      notes: merge3.mergedFields.notes,
      hlc: op3.hlc,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, testEntityId));

  await db.insert(syncOps).values({
    opId: opId3,
    clientId: "device-test-2",
    entityType: "tasks",
    entityId: testEntityId,
    op: op3,
    hlc: op3.hlc,
  });

  // Verify task in DB
  const [updatedTask] = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, testEntityId));

  assert(updatedTask.status === "done", "Task in DB has status 'done'");
  assert(updatedTask.notes === "Completed via offline sync", "Task in DB has updated notes");
  assert(updatedTask.hlc === op3.hlc, "Task in DB has updated HLC");

  // Cleanup test records
  await db.delete(syncOps).where(eq(syncOps.entityId, testEntityId));
  await db.delete(tasks).where(eq(tasks.id, testEntityId));
  console.log("Cleanup completed successfully!");
}

async function main() {
  try {
    await testHlcEngine();
    await testFieldLevelMerge();
    await testDatabaseSyncFlow();
    console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉\n");
    process.exit(0);
  } catch (err) {
    console.error("Test failed with error:", err);
    process.exit(1);
  }
}

main();
