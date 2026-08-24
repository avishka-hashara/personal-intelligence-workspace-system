import { pgTable, uuid, text, timestamp, jsonb, time, smallint } from "drizzle-orm/pg-core";

// ----------------------------------------------------------------------
// Section 7.2.1: Identity and configuration
// ----------------------------------------------------------------------

export const users = pgTable("users", {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").unique().notNull(),
    displayName: text("display_name"),
    timezone: text("timezone"),
    locale: text("locale"),
    onboardingState: jsonb("onboarding_state"),
    plan: text("plan"),

    // Sync & Audit Fields (Standard across all tables per Section 7.2)
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    hlc: text("hlc"),
    version: smallint("version")
});

export const userSettings = pgTable("user_settings", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    quietHoursStart: time("quiet_hours_start"),
    quietHoursEnd: time("quiet_hours_end"),
    digestMorning: time("digest_morning"),
    digestEvening: time("digest_evening"),
    weekStart: smallint("week_start"),
    availableMinutesPerDay: smallint("available_minutes_per_day"),
    theme: text("theme"),
    density: text("density"),

    // Sync & Audit Fields
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    hlc: text("hlc"),
    version: smallint("version")
});