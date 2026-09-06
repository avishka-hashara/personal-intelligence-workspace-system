import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { db } from "../src/server/db";
import {
  users,
  reminders,
  reminderOccurrences,
  notificationDeliveries,
  pushSubscriptions,
} from "../src/server/db/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import { materializeOccurrences } from "../src/server/actions/reminders";

async function runTest2() {
  console.log("===============================================================");
  console.log("TEST 2: Web Push & Occurrence Materialization");
  console.log("===============================================================\n");

  // 1. Get or create a target user
  let [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, "eaahashara01@gmail.com"))
    .limit(1);

  if (!user) {
    const allUsers = await db.select().from(users).limit(1);
    if (allUsers.length > 0) {
      user = allUsers[0];
    } else {
      [user] = await db
        .insert(users)
        .values({
          email: "test-reminder@piw.local",
          displayName: "Reminder Tester",
        })
        .returning();
    }
  }

  console.log(`[Step 1] Selected User: ${user.email} (ID: ${user.id})`);

  // 2. Create the recurring reminder: "Review algorithms at 09:00 daily"
  const fireAt = new Date();
  fireAt.setHours(9, 0, 0, 0);

  const [createdReminder] = await db
    .insert(reminders)
    .values({
      userId: user.id,
      title: "Review algorithms at 09:00 daily",
      fireAt,
      rrule: "RRULE:FREQ=DAILY;INTERVAL=1",
      channel: ["web_push"],
      leadMinutes: 0,
      active: true,
    })
    .returning();

  console.log(`[Step 2] Created Reminder: "${createdReminder.title}" (ID: ${createdReminder.id})`);
  console.log(`         First trigger (fireAt): ${fireAt.toLocaleString()}`);
  console.log(`         Recurrence Rule: ${createdReminder.rrule}`);

  // 3. Materialize occurrences for 30 days
  const matResult = await materializeOccurrences(createdReminder.id);
  console.log(`\n[Step 3] Materialize Occurrences Result:`, matResult);

  // 4. Check reminder_occurrences table in DB
  const occurrences = await db
    .select()
    .from(reminderOccurrences)
    .where(eq(reminderOccurrences.reminderId, createdReminder.id))
    .orderBy(asc(reminderOccurrences.scheduledFor));

  console.log(`\n[Step 4] Verified reminder_occurrences in DB:`);
  console.log(`         Total occurrences materialized: ${occurrences.length}`);
  console.log(`         Occurrences pending: ${occurrences.filter((o) => o.state === "pending").length}`);
  console.log(`         First 3 occurrences:`);
  occurrences.slice(0, 3).forEach((o, idx) => {
    console.log(`           ${idx + 1}. ID: ${o.id} | Scheduled: ${o.scheduledFor.toLocaleString()} | State: ${o.state}`);
  });
  console.log(`         Last occurrence:`);
  const lastOcc = occurrences[occurrences.length - 1];
  console.log(`           ${occurrences.length}. ID: ${lastOcc.id} | Scheduled: ${lastOcc.scheduledFor.toLocaleString()} | State: ${lastOcc.state}`);

  if (occurrences.length < 28 || occurrences.length > 32) {
    throw new Error(`Expected ~30 occurrences, found ${occurrences.length}`);
  }

  // Identify the due occurrence (e.g. today's 09:00 AM)
  const now = new Date();
  const dueOccurrencesBefore = occurrences.filter((o) => new Date(o.scheduledFor) <= now && o.state === "pending");
  console.log(`\n[Step 5] Due pending occurrences ready for dispatch: ${dueOccurrencesBefore.length}`);
  dueOccurrencesBefore.forEach((o) => {
    console.log(`         - ID: ${o.id} scheduled for ${o.scheduledFor.toLocaleString()}`);
  });

  // 5. Trigger test dispatch by hitting http://localhost:3100/api/v1/cron/reminders
  const cronUrl = "http://localhost:3100/api/v1/cron/reminders";
  console.log(`\n[Step 6] Triggering cron dispatch via GET ${cronUrl}...`);

  const response = await fetch(cronUrl);
  const responseData = await response.json();
  console.log(`         Response Status: ${response.status} ${response.statusText}`);
  console.log(`         Response Data:`, responseData);

  // 6. Verify occurrences state transitioned to 'sent'
  const updatedOccurrences = await db
    .select()
    .from(reminderOccurrences)
    .where(eq(reminderOccurrences.reminderId, createdReminder.id))
    .orderBy(asc(reminderOccurrences.scheduledFor));

  const sentOccurrences = updatedOccurrences.filter((o) => o.state === "sent");
  const pendingOccurrences = updatedOccurrences.filter((o) => o.state === "pending");

  console.log(`\n[Step 7] Post-dispatch occurrence state check:`);
  console.log(`         Sent occurrences: ${sentOccurrences.length}`);
  console.log(`         Remaining pending occurrences: ${pendingOccurrences.length}`);

  for (const s of sentOccurrences) {
    console.log(`         ✓ Occurrence ${s.id}: state='${s.state}', deliveredAt=${s.deliveredAt?.toLocaleString()}`);
  }

  if (sentOccurrences.length === 0) {
    throw new Error("Expected at least 1 occurrence to transition to 'sent'");
  }

  // 7. Check notification_deliveries table
  const deliveries = await db
    .select()
    .from(notificationDeliveries)
    .where(eq(notificationDeliveries.occurrenceId, sentOccurrences[0].id));

  console.log(`\n[Step 8] Checking notification_deliveries table:`);
  console.log(`         Deliveries logged for occurrence ${sentOccurrences[0].id}: ${deliveries.length}`);
  deliveries.forEach((d) => {
    console.log(`         ✓ Delivery ID: ${d.id}`);
    console.log(`           Channel: ${d.channel}`);
    console.log(`           Status: ${d.status}`);
    console.log(`           Attempts: ${d.attempts}`);
    console.log(`           Created At: ${d.createdAt.toLocaleString()}`);
  });

  if (deliveries.length === 0) {
    throw new Error("No notification delivery log found in notification_deliveries");
  }

  console.log("\n===============================================================");
  console.log("✓ TEST 2 PASSED SUCCESSFULLY!");
  console.log("===============================================================");
}

runTest2()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Test 2 failed:", err);
    process.exit(1);
  });
