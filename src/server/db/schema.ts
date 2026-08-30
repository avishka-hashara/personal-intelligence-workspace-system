import {
    pgTable, uuid, text, timestamp, jsonb, time, smallint, boolean, integer, primaryKey
} from "drizzle-orm/pg-core";

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

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    hlc: text("hlc"),
    version: smallint("version").default(1)
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

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    hlc: text("hlc"),
    version: smallint("version").default(1)
});

// ----------------------------------------------------------------------
// Section 7.2.5: System tables (Nodes index)
// ----------------------------------------------------------------------

export const nodes = pgTable("nodes", {
    id: uuid("id").primaryKey(), // Matches the typed row's PK
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    title: text("title"),
    snippet: text("snippet"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    // search_tsv will be added as a raw SQL migration during the Search phase
});

// ----------------------------------------------------------------------
// Section 7.2.3: Execution (Tasks, Time, Tags)
// ----------------------------------------------------------------------

export const tasks = pgTable("tasks", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    notes: text("notes"),
    status: text("status").notNull().default("inbox"), // inbox | next | in_progress | blocked | done | cancelled
    priority: smallint("priority").default(0), // 0-3
    dueAt: timestamp("due_at", { withTimezone: true }),
    deferUntil: timestamp("defer_until", { withTimezone: true }),
    estimateMinutes: integer("estimate_minutes"),
    actualMinutes: integer("actual_minutes"),
    rrule: text("rrule"),
    recurrenceParentId: uuid("recurrence_parent_id"),
    isContainer: boolean("is_container").default(false),
    sortKey: text("sort_key"),
    energy: text("energy"),
    milestoneId: uuid("milestone_id"),
    parentTaskId: uuid("parent_task_id"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    hlc: text("hlc"),
    version: smallint("version").default(1)
});

export const focusSessions = pgTable("focus_sessions", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    taskId: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }).notNull(),
    minutes: integer("minutes").notNull(),
    interruptions: integer("interruptions").default(0).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    hlc: text("hlc"),
    version: smallint("version").default(1)
});

export const tags = pgTable("tags", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    colour: text("colour"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    hlc: text("hlc"),
    version: smallint("version").default(1)
});

export const nodeTags = pgTable("node_tags", {
    nodeId: uuid("node_id").notNull().references(() => nodes.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
}, (t) => [
    primaryKey({ columns: [t.nodeId, t.tagId] })
]);