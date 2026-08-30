import { db } from "@/server/db";
import { userSettings } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export interface PersonaSettings {
  assistantName: string;
  userName: string | null;
  memorySummary: string | null;
  personaTone: string;
}

const DEFAULT_SETTINGS: PersonaSettings = {
  assistantName: "Copilot",
  userName: null,
  memorySummary: null,
  personaTone: "warm",
};

// In-memory session cache (5 minute TTL)
const settingsCache = new Map<string, { data: PersonaSettings; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function getPersonaSettings(userId: string): Promise<PersonaSettings> {
  const cached = settingsCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  try {
    const [row] = await db
      .select({
        assistantName: userSettings.assistantName,
        userName: userSettings.userName,
        memorySummary: userSettings.memorySummary,
        personaTone: userSettings.personaTone,
      })
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    if (row) {
      const data: PersonaSettings = {
        assistantName: row.assistantName || DEFAULT_SETTINGS.assistantName,
        userName: row.userName ?? null,
        memorySummary: row.memorySummary ?? null,
        personaTone: row.personaTone || DEFAULT_SETTINGS.personaTone,
      };
      settingsCache.set(userId, { data, expiresAt: Date.now() + CACHE_TTL_MS });
      return data;
    }

    // If no userSettings row exists, create one
    try {
      const [inserted] = await db
        .insert(userSettings)
        .values({
          userId,
          assistantName: DEFAULT_SETTINGS.assistantName,
          personaTone: DEFAULT_SETTINGS.personaTone,
        })
        .returning({
          assistantName: userSettings.assistantName,
          userName: userSettings.userName,
          memorySummary: userSettings.memorySummary,
          personaTone: userSettings.personaTone,
        });

      if (inserted) {
        const data: PersonaSettings = {
          assistantName: inserted.assistantName || DEFAULT_SETTINGS.assistantName,
          userName: inserted.userName ?? null,
          memorySummary: inserted.memorySummary ?? null,
          personaTone: inserted.personaTone || DEFAULT_SETTINGS.personaTone,
        };
        settingsCache.set(userId, { data, expiresAt: Date.now() + CACHE_TTL_MS });
        return data;
      }
    } catch {
      // Ignore insert race conditions
    }

    settingsCache.set(userId, { data: DEFAULT_SETTINGS, expiresAt: Date.now() + CACHE_TTL_MS });
    return DEFAULT_SETTINGS;
  } catch (error) {
    console.error("[settingsService] Error fetching persona settings:", error);
    return DEFAULT_SETTINGS;
  }
}

export async function updatePersonaSettings(
  userId: string,
  updates: Partial<PersonaSettings>
): Promise<PersonaSettings> {
  try {
    const existing = await getPersonaSettings(userId);
    const updatedData: PersonaSettings = {
      ...existing,
      ...updates,
    };

    const [updatedRow] = await db
      .update(userSettings)
      .set({
        assistantName: updatedData.assistantName,
        userName: updatedData.userName,
        memorySummary: updatedData.memorySummary,
        personaTone: updatedData.personaTone,
        updatedAt: new Date(),
      })
      .where(eq(userSettings.userId, userId))
      .returning({
        assistantName: userSettings.assistantName,
        userName: userSettings.userName,
        memorySummary: userSettings.memorySummary,
        personaTone: userSettings.personaTone,
      });

    if (!updatedRow) {
      // If row did not exist to update, insert it
      await db.insert(userSettings).values({
        userId,
        assistantName: updatedData.assistantName,
        userName: updatedData.userName,
        memorySummary: updatedData.memorySummary,
        personaTone: updatedData.personaTone,
      });
    }

    settingsCache.set(userId, { data: updatedData, expiresAt: Date.now() + CACHE_TTL_MS });
    return updatedData;
  } catch (error) {
    console.error("[settingsService] Error updating persona settings:", error);
    const cached = settingsCache.get(userId)?.data || DEFAULT_SETTINGS;
    const merged = { ...cached, ...updates };
    settingsCache.set(userId, { data: merged, expiresAt: Date.now() + CACHE_TTL_MS });
    return merged;
  }
}
