"use server";

import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateOnboardingState(step: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Unauthorized" };
  }

  try {
    const existing = await db
      .select({ onboardingState: users.onboardingState })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    const currentState = (existing[0]?.onboardingState as Record<string, any>) || {};
    const completedSteps = Array.isArray(currentState.completed_steps)
      ? [...currentState.completed_steps]
      : [];

    if (!completedSteps.includes(step)) {
      completedSteps.push(step);
    }

    const updatedState = {
      ...currentState,
      [step]: true,
      completed_steps: completedSteps,
      last_step: step,
      updated_at: new Date().toISOString(),
    };

    await db
      .update(users)
      .set({
        onboardingState: updatedState,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    revalidatePath("/");
    revalidatePath("/(app)", "layout");

    return { success: true, onboardingState: updatedState };
  } catch (err: any) {
    console.error("[updateOnboardingState Error]:", err);
    return { error: err?.message || "Failed to update onboarding state" };
  }
}
