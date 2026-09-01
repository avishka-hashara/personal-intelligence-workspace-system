"use server";

import { db } from "@/server/db";
import { users, userSettings } from "@/server/db/schema";
import { eq, isNull } from "drizzle-orm";
import { getCurrentUser } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export interface AISettings {
  masterEnabled: boolean;
  copilotEnabled: boolean;
  reviewSynthesisEnabled: boolean;
  coachingNudgesEnabled: boolean;
  replanEnabled: boolean;
  quizGenEnabled: boolean;
  excludeJournalFromAI: boolean;
  monthlySpendCap: number; // in USD, e.g. 10
}

const DEFAULT_AI_SETTINGS: AISettings = {
  masterEnabled: true,
  copilotEnabled: true,
  reviewSynthesisEnabled: true,
  coachingNudgesEnabled: true,
  replanEnabled: true,
  quizGenEnabled: true,
  excludeJournalFromAI: false,
  monthlySpendCap: 10,
};

export async function getAISettings(explicitUserId?: string): Promise<AISettings> {
  const user = explicitUserId ? { id: explicitUserId } : await getCurrentUser();
  if (!user) {
    return DEFAULT_AI_SETTINGS;
  }

  try {
    const [userRow] = await db
      .select({ onboardingState: users.onboardingState })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    const onboarding = (userRow?.onboardingState as Record<string, any>) || {};
    const aiPreferences = onboarding.ai_preferences || {};

    return {
      masterEnabled:
        typeof aiPreferences.masterEnabled === "boolean"
          ? aiPreferences.masterEnabled
          : DEFAULT_AI_SETTINGS.masterEnabled,
      copilotEnabled:
        typeof aiPreferences.copilotEnabled === "boolean"
          ? aiPreferences.copilotEnabled
          : DEFAULT_AI_SETTINGS.copilotEnabled,
      reviewSynthesisEnabled:
        typeof aiPreferences.reviewSynthesisEnabled === "boolean"
          ? aiPreferences.reviewSynthesisEnabled
          : DEFAULT_AI_SETTINGS.reviewSynthesisEnabled,
      coachingNudgesEnabled:
        typeof aiPreferences.coachingNudgesEnabled === "boolean"
          ? aiPreferences.coachingNudgesEnabled
          : DEFAULT_AI_SETTINGS.coachingNudgesEnabled,
      replanEnabled:
        typeof aiPreferences.replanEnabled === "boolean"
          ? aiPreferences.replanEnabled
          : DEFAULT_AI_SETTINGS.replanEnabled,
      quizGenEnabled:
        typeof aiPreferences.quizGenEnabled === "boolean"
          ? aiPreferences.quizGenEnabled
          : DEFAULT_AI_SETTINGS.quizGenEnabled,
      excludeJournalFromAI:
        typeof aiPreferences.excludeJournalFromAI === "boolean"
          ? aiPreferences.excludeJournalFromAI
          : DEFAULT_AI_SETTINGS.excludeJournalFromAI,
      monthlySpendCap:
        typeof aiPreferences.monthlySpendCap === "number"
          ? aiPreferences.monthlySpendCap
          : DEFAULT_AI_SETTINGS.monthlySpendCap,
    };
  } catch (error) {
    console.error("Failed to fetch AI settings:", error);
    return DEFAULT_AI_SETTINGS;
  }
}

export async function updateAISettings(
  newSettings: Partial<AISettings>,
  explicitUserId?: string
): Promise<{ success: boolean; settings?: AISettings; error?: string }> {
  const user = explicitUserId ? { id: explicitUserId } : await getCurrentUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const current = await getAISettings(user.id);
    const updated: AISettings = {
      ...current,
      ...newSettings,
    };

    const [userRow] = await db
      .select({ onboardingState: users.onboardingState })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    const onboarding = (userRow?.onboardingState as Record<string, any>) || {};
    const updatedOnboarding = {
      ...onboarding,
      ai_preferences: updated,
      updated_at: new Date().toISOString(),
    };

    await db
      .update(users)
      .set({
        onboardingState: updatedOnboarding,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    try {
      revalidatePath("/settings/ai");
      revalidatePath("/");
    } catch {}

    return { success: true, settings: updated };
  } catch (error: any) {
    console.error("Failed to update AI settings:", error);
    return { success: false, error: error?.message || "Failed to update AI settings" };
  }
}
