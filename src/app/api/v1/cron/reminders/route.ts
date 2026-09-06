import { NextRequest } from "next/server";
import { db } from "@/server/db";
import {
  reminders,
  reminderOccurrences,
  notificationDeliveries,
  pushSubscriptions,
} from "@/server/db/schema";
import { eq, and, lte, isNull, asc } from "drizzle-orm";
import { sendWebPushNotification } from "@/server/notifications/webpush";

export async function processReminderTick() {
  const now = new Date();

  // 1. Query pending occurrences where scheduled_for <= now()
  const dueOccurrences = await db
    .select({
      occurrence: reminderOccurrences,
      reminder: reminders,
    })
    .from(reminderOccurrences)
    .innerJoin(reminders, eq(reminderOccurrences.reminderId, reminders.id))
    .where(
      and(
        lte(reminderOccurrences.scheduledFor, now),
        eq(reminderOccurrences.state, "pending"),
        isNull(reminderOccurrences.deletedAt),
        isNull(reminders.deletedAt)
      )
    )
    .orderBy(asc(reminderOccurrences.scheduledFor))
    .limit(100);

  let deliveredCount = 0;
  let failedCount = 0;

  for (const item of dueOccurrences) {
    const { occurrence, reminder } = item;

    // 2. Fetch user's registered push subscriptions
    const subscriptions = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, occurrence.userId));

    if (subscriptions.length > 0) {
      for (const sub of subscriptions) {
        const pushResult = await sendWebPushNotification(sub, {
          title: reminder.title,
          body: `Reminder: ${reminder.title}`,
          url: "/",
          occurrenceId: occurrence.id,
        });

        // 3. Record log into notification_deliveries
        await db.insert(notificationDeliveries).values({
          userId: occurrence.userId,
          occurrenceId: occurrence.id,
          channel: "web_push",
          providerMessageId: pushResult.providerMessageId || null,
          status: pushResult.success ? "delivered" : "failed",
          error: pushResult.error || null,
          attempts: 1,
        });

        if (pushResult.success) {
          deliveredCount++;
        } else {
          failedCount++;
        }
      }
    } else {
      // Record in-app notification delivery when no push subscriptions exist
      await db.insert(notificationDeliveries).values({
        userId: occurrence.userId,
        occurrenceId: occurrence.id,
        channel: "in_app",
        status: "delivered",
        attempts: 1,
      });
      deliveredCount++;
    }

    // 4. Update occurrence to 'sent'
    await db
      .update(reminderOccurrences)
      .set({
        state: "sent",
        deliveredAt: now,
        updatedAt: now,
      })
      .where(eq(reminderOccurrences.id, occurrence.id));
  }

  return {
    success: true,
    processed: dueOccurrences.length,
    deliveredCount,
    failedCount,
    timestamp: now.toISOString(),
  };
}

export async function GET(req: NextRequest) {
  try {
    const result = await processReminderTick();
    return Response.json(result);
  } catch (error: unknown) {
    console.error("Reminder tick error:", error);
    return Response.json(
      { error: "Failed to dispatch reminders", details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const result = await processReminderTick();
    return Response.json(result);
  } catch (error: unknown) {
    console.error("Reminder tick error:", error);
    return Response.json(
      { error: "Failed to dispatch reminders", details: String(error) },
      { status: 500 }
    );
  }
}
