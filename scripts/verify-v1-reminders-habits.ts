import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { db } from "../src/server/db";
import {
  users,
  habits,
  habitLogs,
  habitPauses,
  reminders,
  reminderOccurrences,
  notificationDeliveries,
  pushSubscriptions,
} from "../src/server/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { format, subDays, addDays } from "date-fns";
import {
  calculateHabitStreak,
  pauseHabit,
  resumeHabit,
} from "../src/server/actions/habits";
import {
  materializeOccurrences,
  createReminder,
} from "../src/server/actions/reminders";
import { processReminderTick } from "../src/app/api/v1/cron/reminders/route";
import webpush from "web-push";

async function runVerification() {
  console.log("=== STARTING V1.0 SPECIFICATIONS VERIFICATION ===\n");

  // 0. Ensure a test user exists
  let [testUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, "test-v1-features@piw.local"))
    .limit(1);

  if (!testUser) {
    [testUser] = await db
      .insert(users)
      .values({
        email: "test-v1-features@piw.local",
        displayName: "V1 Test User",
      })
      .returning();
  }
  console.log(`✓ Test user verified: ${testUser.id} (${testUser.email})\n`);

  // =========================================================================
  // TASK 1: Habit Pauses Schema & Streak Logic
  // =========================================================================
  console.log("--- TEST 1: Habit Pauses Schema & Streak Logic ---");
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const yesterdayStr = format(subDays(today, 1), "yyyy-MM-dd");
  const twoDaysAgoStr = format(subDays(today, 2), "yyyy-MM-dd");
  const threeDaysAgoStr = format(subDays(today, 3), "yyyy-MM-dd");

  // Create a test habit
  const [testHabit] = await db
    .insert(habits)
    .values({
      userId: testUser.id,
      title: "Reading 30 mins",
      cadence: "daily",
      active: true,
    })
    .returning();
  console.log(`Created habit: "${testHabit.title}" (${testHabit.id})`);

  // Insert logs for 3 days ago and 2 days ago
  await db.insert(habitLogs).values([
    {
      userId: testUser.id,
      habitId: testHabit.id,
      loggedOn: threeDaysAgoStr,
      value: "1",
    },
    {
      userId: testUser.id,
      habitId: testHabit.id,
      loggedOn: twoDaysAgoStr,
      value: "1",
    },
  ]);

  // Check streak before pause: yesterday and today were NOT logged, so streak is 0
  const streakBeforePause = await calculateHabitStreak(testHabit.id, todayStr);
  console.log(
    `Streak before pause (yesterday not logged, today not logged): currentStreak = ${streakBeforePause.currentStreak}, isPaused = ${streakBeforePause.isPaused}`
  );
  if (streakBeforePause.currentStreak !== 0) {
    throw new Error(
      `Expected streak to be 0 before pause, got ${streakBeforePause.currentStreak}`
    );
  }

  // Now, pause the habit covering yesterday through tomorrow (e.g. sick/exam)
  const tomorrowStr = format(addDays(today, 1), "yyyy-MM-dd");
  const [pauseRecord] = await db
    .insert(habitPauses)
    .values({
      userId: testUser.id,
      habitId: testHabit.id,
      startOn: yesterdayStr,
      endOn: tomorrowStr,
      reason: "Exam preparation week",
    })
    .returning();
  console.log(
    `Added pause window: ${pauseRecord.startOn} to ${pauseRecord.endOn} (reason: ${pauseRecord.reason})`
  );

  // Recalculate streak: since yesterday and today are paused, streak should NOT be marked as broken!
  const streakAfterPause = await calculateHabitStreak(testHabit.id, todayStr);
  console.log(
    `Streak after pause: currentStreak = ${streakAfterPause.currentStreak}, isPaused = ${streakAfterPause.isPaused}`
  );

  if (!streakAfterPause.isPaused) {
    throw new Error("Expected habit to be recognized as isPaused = true");
  }
  if (streakAfterPause.currentStreak !== 2) {
    throw new Error(
      `Expected currentStreak to be 2 (protected across pause), but got ${streakAfterPause.currentStreak}`
    );
  }
  console.log("✓ PASS: Habit pause preserved streak! Streak was NOT marked as broken.\n");

  // Clean up habit pause test
  await db.delete(habitPauses).where(eq(habitPauses.id, pauseRecord.id));
  await db.delete(habitLogs).where(eq(habitLogs.habitId, testHabit.id));
  await db.delete(habits).where(eq(habits.id, testHabit.id));

  // =========================================================================
  // TASK 2: Reminder Occurrence Materialization
  // =========================================================================
  console.log("--- TEST 2: Reminder Occurrence Materialization (RRULE 30 Days) ---");

  // Create a recurring reminder with RRULE: daily
  const [testReminder] = await db
    .insert(reminders)
    .values({
      userId: testUser.id,
      title: "Daily Review & Wind-down",
      fireAt: today,
      rrule: "RRULE:FREQ=DAILY;INTERVAL=1",
      channel: ["web_push"],
      active: true,
    })
    .returning();
  console.log(`Created reminder: "${testReminder.title}" (${testReminder.id})`);

  // Materialize occurrences for the next 30 days
  const matResult = await materializeOccurrences(testReminder.id);
  console.log("Materialize result:", matResult);

  if (!matResult.success) {
    throw new Error(`Materialization failed: ${matResult.message}`);
  }
  if (matResult.count < 28 || matResult.count > 32) {
    throw new Error(
      `Expected approximately 30 occurrences materialized, got ${matResult.count}`
    );
  }

  // Verify occurrences in the database
  const occurrences = await db
    .select()
    .from(reminderOccurrences)
    .where(eq(reminderOccurrences.reminderId, testReminder.id));

  console.log(`Stored occurrences count: ${occurrences.length}`);
  const allPending = occurrences.every((o) => o.state === "pending");
  if (!allPending) {
    throw new Error("Expected all generated occurrences to have state = 'pending'");
  }
  console.log("✓ All occurrences have state = 'pending'");

  // Test idempotency: calling materializeOccurrences again should insert 0 duplicates
  const secondMatResult = await materializeOccurrences(testReminder.id);
  console.log("Second materialize call (idempotency check): count =", secondMatResult.count);
  if (secondMatResult.count !== 0) {
    throw new Error(`Expected 0 duplicate occurrences, got ${secondMatResult.count}`);
  }
  console.log("✓ PASS: Reminder occurrence materialization succeeded with 30-day RRULE and is idempotent!\n");

  // =========================================================================
  // TASK 3: Scheduled Dispatcher Tick API & Web Push
  // =========================================================================
  console.log("--- TEST 3: Scheduled Dispatcher Tick API & Web Push ---");

  // Generate ephemeral VAPID keys for testing
  const testVapid = webpush.generateVAPIDKeys();
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = testVapid.publicKey;
  process.env.VAPID_PRIVATE_KEY = testVapid.privateKey;
  process.env.VAPID_SUBJECT = "mailto:test@piw.local";

  // Register a push subscription for the test user
  const [sub] = await db
    .insert(pushSubscriptions)
    .values({
      userId: testUser.id,
      endpoint: "https://fcm.googleapis.com/fcm/send/fake-test-subscription-token-12345",
      p256dh: "BMaK7wH1-TEST-KEY-P256DH-abc123xyz456",
      auth: "TEST-AUTH-SECRET-123",
      userAgent: "Mozilla/5.0 Test Agent",
    })
    .returning();
  console.log(`Registered test push subscription: ${sub.id}`);

  // Create a due occurrence (scheduled for 2 minutes in the past)
  const dueTime = new Date(Date.now() - 2 * 60 * 1000);
  const [dueOccurrence] = await db
    .insert(reminderOccurrences)
    .values({
      userId: testUser.id,
      reminderId: testReminder.id,
      scheduledFor: dueTime,
      state: "pending",
    })
    .returning();
  console.log(`Created due occurrence (${dueOccurrence.id}) scheduled for: ${dueOccurrence.scheduledFor.toISOString()}`);

  // Run the scheduled dispatcher tick
  const tickResult = await processReminderTick();
  console.log("Dispatcher Tick execution result:", tickResult);

  if (!tickResult.success || tickResult.processed === 0) {
    throw new Error(`Expected at least 1 processed occurrence, got ${tickResult.processed}`);
  }

  // Verify that the occurrence state was updated to 'sent'
  const [updatedOccurrence] = await db
    .select()
    .from(reminderOccurrences)
    .where(eq(reminderOccurrences.id, dueOccurrence.id));

  console.log(`Occurrence state after tick: state = '${updatedOccurrence.state}', deliveredAt = ${updatedOccurrence.deliveredAt?.toISOString()}`);
  if (updatedOccurrence.state !== "sent") {
    throw new Error(`Expected occurrence state = 'sent', got '${updatedOccurrence.state}'`);
  }
  if (!updatedOccurrence.deliveredAt) {
    throw new Error("Expected deliveredAt to be populated");
  }

  // Verify that a log was recorded in notification_deliveries
  const deliveries = await db
    .select()
    .from(notificationDeliveries)
    .where(eq(notificationDeliveries.occurrenceId, dueOccurrence.id));

  console.log(`Recorded notification deliveries count: ${deliveries.length}`);
  if (deliveries.length === 0) {
    throw new Error("Expected delivery attempt to be recorded in notification_deliveries");
  }
  const delivery = deliveries[0];
  console.log(`Delivery record: channel = '${delivery.channel}', status = '${delivery.status}', attempts = ${delivery.attempts}`);
  console.log("✓ PASS: Dispatcher claimed due occurrence, updated state to 'sent', and logged delivery!\n");

  // Clean up test data
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, testUser.id));
  await db.delete(notificationDeliveries).where(eq(notificationDeliveries.userId, testUser.id));
  await db.delete(reminderOccurrences).where(eq(reminderOccurrences.userId, testUser.id));
  await db.delete(reminders).where(eq(reminders.userId, testUser.id));
  await db.delete(users).where(eq(users.id, testUser.id));

  console.log("=== ALL V1.0 SPECIFICATIONS VERIFIED SUCCESSFULLY! ===");
  process.exit(0);
}

runVerification().catch((err) => {
  console.error("❌ Verification failed:", err);
  process.exit(1);
});
