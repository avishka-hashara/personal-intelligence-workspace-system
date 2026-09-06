import { NextRequest } from "next/server";
import { getCurrentUser } from "@/utils/supabase/server";
import { savePushSubscription } from "@/server/actions/reminders";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { subscription } = body;

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return Response.json(
        { error: "Invalid subscription object" },
        { status: 400 }
      );
    }

    const userAgent = req.headers.get("user-agent") || undefined;
    const result = await savePushSubscription(subscription, userAgent);

    return Response.json(result);
  } catch (error: unknown) {
    console.error("Push subscribe error:", error);
    return Response.json(
      { error: "Failed to save push subscription" },
      { status: 500 }
    );
  }
}
