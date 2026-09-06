"use server";

import { db } from "@/server/db";
import {
  reminders,
  reminderOccurrences,
  pushSubscriptions,
  notificationDeliveries,
} from "@/server/db/schema";
import { eq, and, isNull, gte, lte, desc, asc } from "drizzle-orm";
import { getCurrentUser } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { RRule, rrulestr } from "rrule";
import { addDays } from "date-fns";

export interface CreateReminderInput {
  title: string;
  nodeId?: string | null;
  fireAt?: string | Date | null;
  rrule?: string | null;
  channel?: string[];
  leadMinutes?: number | null;
  active?: boolean;
}

/**
 * Materializes all occurrence timestamps for the next 30 days based on the reminder's rrule (or fireAt)
 * and stores them in reminder_occurrences with state = 'pending'.
 */
export async function materializeOccurrences(reminderId: string) {
  const [reminder] = await db
    .select()
    .from(reminders)
    .where(and(eq(reminders.id, reminderId), isNull(reminders.deletedAt)))
    .limit(1);

  if (!reminder) {
    return { success: false, count: 0, message: "Reminder not found" };
  }

  if (!reminder.active) {
    return { success: false, count: 0, message: "Reminder is inactive" };
  }

  const now = new Date();
  const horizon = addDays(now, 30);
  const timestamps: Date[] = [];

  if (reminder.rrule) {
    try {
      const dtstart = reminder.fireAt ? new Date(reminder.fireAt) : new Date(reminder.createdAt);
      dtstart.setMilliseconds(0);

      let rule: RRule;
      try {
        const cleanRrule = reminder.rrule.replace(/^RRULE:/i, "");
        const parsedOpts = RRule.parseString(cleanRrule);
        parsedOpts.dtstart = parsedOpts.dtstart || dtstart;
        rule = new RRule(parsedOpts);
      } catch {
        rule = rrulestr(reminder.rrule, { dtstart }) as RRule;
      }

      const startDate = dtstart <= now && dtstart >= addDays(now, -1) ? dtstart : now;
      const generatedDates = rule.between(startDate, horizon, true);
      for (const d of generatedDates) {
        timestamps.push(d);
      }
    } catch (err) {
      console.error("Failed to parse reminder recurrence rule:", err);
    }
  } else if (reminder.fireAt) {
    // One-off reminder
    const fireDate = new Date(reminder.fireAt);
    if (fireDate >= addDays(now, -1) && fireDate <= horizon) {
      timestamps.push(fireDate);
    }
  }

  // Fetch existing occurrences for this reminder to prevent duplicate rows
  const existingOccurrences = await db
    .select({ scheduledFor: reminderOccurrences.scheduledFor })
    .from(reminderOccurrences)
    .where(
      and(
        eq(reminderOccurrences.reminderId, reminder.id),
        isNull(reminderOccurrences.deletedAt)
      )
    );

  const existingSeconds = new Set(
    existingOccurrences.map((o) => Math.floor(new Date(o.scheduledFor).getTime() / 1000))
  );

  const newOccurrences = timestamps
    .map((t) => {
      const d = new Date(t);
      d.setMilliseconds(0);
      return d;
    })
    .filter((t) => !existingSeconds.has(Math.floor(t.getTime() / 1000)))
    .map((t) => ({
      userId: reminder.userId,
      reminderId: reminder.id,
      scheduledFor: t,
      state: "pending",
    }));

  if (newOccurrences.length > 0) {
    await db.insert(reminderOccurrences).values(newOccurrences);
  }

  return {
    success: true,
    count: newOccurrences.length,
    totalOccurrences: timestamps.length,
  };
}

export async function createReminder(input: CreateReminderInput) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Unauthorized" };
  }

  const title = input.title?.trim();
  if (!title) {
    return { error: "Title is required" };
  }

  try {
    const fireAtDate = input.fireAt ? new Date(input.fireAt) : new Date();

    const [reminder] = await db
      .insert(reminders)
      .values({
        userId: user.id,
        nodeId: input.nodeId || null,
        title,
        fireAt: fireAtDate,
        rrule: input.rrule || null,
        channel: input.channel || ["web_push"],
        leadMinutes: input.leadMinutes || 0,
        active: input.active !== undefined ? input.active : true,
      })
      .returning();

    // Materialize occurrences for the next 30 days
    await materializeOccurrences(reminder.id);

    revalidatePath("/");
    return { success: true, reminder };
  } catch (error) {
    console.error("Failed to create reminder:", error);
    return { error: "Failed to create reminder" };
  }
}

export async function getReminders() {
  const user = await getCurrentUser();
  if (!user) return [];

  try {
    return await db
      .select()
      .from(reminders)
      .where(and(eq(reminders.userId, user.id), isNull(reminders.deletedAt)))
      .orderBy(desc(reminders.createdAt));
  } catch (error) {
    console.error("Failed to fetch reminders:", error);
    return [];
  }
}

export async function getPendingOccurrences() {
  const user = await getCurrentUser();
  if (!user) return [];

  try {
    return await db
      .select()
      .from(reminderOccurrences)
      .where(
        and(
          eq(reminderOccurrences.userId, user.id),
          eq(reminderOccurrences.state, "pending"),
          isNull(reminderOccurrences.deletedAt)
        )
      )
      .orderBy(asc(reminderOccurrences.scheduledFor));
  } catch (error) {
    console.error("Failed to fetch pending occurrences:", error);
    return [];
  }
}

export async function snoozeOccurrence(occurrenceId: string, snoozeMinutes = 10) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };

  try {
    const [occurrence] = await db
      .select()
      .from(reminderOccurrences)
      .where(
        and(
          eq(reminderOccurrences.id, occurrenceId),
          eq(reminderOccurrences.userId, user.id)
        )
      )
      .limit(1);

    if (!occurrence) return { error: "Occurrence not found" };

    const newScheduledFor = new Date(Date.now() + snoozeMinutes * 60 * 1000);

    // Update existing occurrence to snoozed
    await db
      .update(reminderOccurrences)
      .set({ state: "snoozed" })
      .where(eq(reminderOccurrences.id, occurrenceId));

    // Create a new snoozed occurrence
    const [snoozed] = await db
      .insert(reminderOccurrences)
      .values({
        userId: user.id,
        reminderId: occurrence.reminderId,
        scheduledFor: newScheduledFor,
        state: "pending",
      })
      .returning();

    revalidatePath("/");
    return { success: true, occurrence: snoozed };
  } catch (error) {
    console.error("Failed to snooze occurrence:", error);
    return { error: "Failed to snooze occurrence" };
  }
}

export async function dismissOccurrence(occurrenceId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };

  try {
    await db
      .update(reminderOccurrences)
      .set({ state: "dismissed" })
      .where(
        and(
          eq(reminderOccurrences.id, occurrenceId),
          eq(reminderOccurrences.userId, user.id)
        )
      );

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Failed to dismiss occurrence:", error);
    return { error: "Failed to dismiss occurrence" };
  }
}

export async function savePushSubscription(
  subscription: {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  },
  userAgent?: string
) {
  const user = await getCurrentUser();
  if (!user) return { error: "Unauthorized" };

  if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    return { error: "Invalid push subscription object" };
  }

  try {
    // Check if endpoint already exists for this user
    const [existing] = await db
      .select()
      .from(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.userId, user.id),
          eq(pushSubscriptions.endpoint, subscription.endpoint)
        )
      )
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(pushSubscriptions)
        .set({
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          userAgent: userAgent || null,
          lastSeenAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(pushSubscriptions.id, existing.id))
        .returning();

      return { success: true, subscription: updated };
    } else {
      const [created] = await db
        .insert(pushSubscriptions)
        .values({
          userId: user.id,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          userAgent: userAgent || null,
        })
        .returning();

      return { success: true, subscription: created };
    }
  } catch (error) {
    console.error("Failed to save push subscription:", error);
    return { error: "Failed to save push subscription" };
  }
}
