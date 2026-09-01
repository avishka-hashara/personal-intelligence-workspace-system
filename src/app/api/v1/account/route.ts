import { NextRequest } from "next/server";
import { getCurrentUser, createClient } from "@/utils/supabase/server";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.email) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    let confirmEmail = "";
    try {
      const body = await req.json();
      confirmEmail = body.confirm_email || body.confirmEmail || "";
    } catch {
      return Response.json(
        { error: "Invalid JSON body. Expected { confirm_email }" },
        { status: 400 }
      );
    }

    if (!confirmEmail || confirmEmail.trim().toLowerCase() !== user.email.trim().toLowerCase()) {
      return Response.json(
        { error: "Confirmation email does not match your authenticated account email." },
        { status: 400 }
      );
    }

    // 7-day grace period timestamp
    const now = new Date();
    const scheduledPurgeAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [userRow] = await db
      .select({ onboardingState: users.onboardingState })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    const currentOnboarding = (userRow?.onboardingState as Record<string, any>) || {};
    const updatedOnboarding = {
      ...currentOnboarding,
      pending_deletion: true,
      deletion_requested_at: now.toISOString(),
      scheduled_purge_at: scheduledPurgeAt.toISOString(),
    };

    // Mark user as pending_deletion with soft delete timestamp
    await db
      .update(users)
      .set({
        deletedAt: now,
        onboardingState: updatedOnboarding,
        updatedAt: now,
      })
      .where(eq(users.id, user.id));

    // Revoke user's active session
    try {
      const supabase = await createClient();
      await supabase.auth.signOut();
    } catch (authErr) {
      console.warn("Session signout warning:", authErr);
    }

    return Response.json({
      success: true,
      message:
        "Account marked as pending deletion. You have a 7-day grace period before data is permanently purged.",
      deletion_requested_at: now.toISOString(),
      scheduled_purge_at: scheduledPurgeAt.toISOString(),
    });
  } catch (error: any) {
    console.error("Account deletion endpoint error:", error);
    return Response.json(
      { error: error?.message || "Failed to process account deletion request." },
      { status: 500 }
    );
  }
}
