import webpush from "web-push";
import { db } from "@/server/db";
import { pushSubscriptions } from "@/server/db/schema";
import { eq } from "drizzle-orm";

// Global cache for fallback VAPID keys in local development / testing
let cachedVapidKeys: { publicKey: string; privateKey: string } | null = null;

export function getVapidKeys(): { publicKey: string; privateKey: string; subject: string } {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:reminders@personal-intelligence.workspace";

  if (publicKey && privateKey) {
    return { publicKey, privateKey, subject };
  }

  // If not configured in environment, generate ephemeral keys for local development
  if (!cachedVapidKeys) {
    cachedVapidKeys = webpush.generateVAPIDKeys();
    console.log("ℹ️ Generated ephemeral development VAPID keys:", {
      publicKey: cachedVapidKeys.publicKey,
    });
  }

  return {
    publicKey: cachedVapidKeys.publicKey,
    privateKey: cachedVapidKeys.privateKey,
    subject,
  };
}

let isVapidInitialized = false;

export function ensureVapidDetails() {
  const { publicKey, privateKey, subject } = getVapidKeys();
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    isVapidInitialized = true;
  } catch (err) {
    console.error("Failed to set VAPID details:", err);
  }
}

export interface WebPushPayload {
  title: string;
  body: string;
  url?: string;
  occurrenceId?: string;
  tag?: string;
}

export interface PushResult {
  success: boolean;
  statusCode?: number;
  error?: string;
  providerMessageId?: string;
  unsubscribed?: boolean;
}

/**
 * Sends a web push notification to a specific push subscription.
 * If the subscription returns 404 or 410, it is automatically pruned from push_subscriptions.
 */
export async function sendWebPushNotification(
  subscription: {
    id?: string;
    endpoint: string;
    p256dh: string;
    auth: string;
  },
  payload: WebPushPayload
): Promise<PushResult> {
  ensureVapidDetails();

  const pushSubscription: webpush.PushSubscription = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  };

  const payloadString = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || "/",
    occurrenceId: payload.occurrenceId,
    tag: payload.tag || "piw-reminder",
    timestamp: Date.now(),
  });

  try {
    const result = await webpush.sendNotification(pushSubscription, payloadString, {
      TTL: 3600, // 1 hour TTL per Section 13 specification
      urgency: "high",
    });

    return {
      success: true,
      statusCode: result.statusCode,
      providerMessageId: (result.headers?.["location"] as string) || (result.headers?.["apns-id"] as string) || undefined,
    };
  } catch (error: unknown) {
    const err = error as { statusCode?: number; message?: string; body?: string };
    const statusCode = err.statusCode || 500;
    const errorMessage = err.message || err.body || "Unknown web push error";

    // A 404 or 410 response prunes the dead subscription
    if ((statusCode === 404 || statusCode === 410) && subscription.id) {
      console.warn(`Pruning dead push subscription (${statusCode}):`, subscription.id);
      try {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, subscription.id));
      } catch (pruneErr) {
        console.error("Failed to prune dead subscription:", pruneErr);
      }
      return {
        success: false,
        statusCode,
        error: `Subscription expired (${statusCode}). Pruned.`,
        unsubscribed: true,
      };
    }

    return {
      success: false,
      statusCode,
      error: errorMessage,
    };
  }
}
