import {
    pgTable, uuid, text, timestamp, jsonb, time, smallint, boolean, integer, numeric, date, unique, primaryKey, vector
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

    // Copilot Assistant Persona & Memory
    assistantName: text("assistant_name").default("Copilot"),
    userName: text("user_name"),
    memorySummary: text("memory_summary"),
    personaTone: text("persona_tone").default("warm"),

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
    embedding: vector("embedding", { dimensions: 1536 }),
    embeddingHash: text("embedding_hash"),
    embeddedAt: timestamp("embedded_at", { withTimezone: true }),
});

// ----------------------------------------------------------------------
// Section 7.2.2: Intent (Directions, Goals, Objectives, Roadmaps, Stages, Milestones)
// ----------------------------------------------------------------------

export const directions = pgTable("directions", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    narrative: text("narrative"),
    horizonYears: smallint("horizon_years"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    hlc: text("hlc"),
    version: smallint("version").default(1)
});

export const goals = pgTable("goals", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    directionId: uuid("direction_id").references(() => directions.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description"),
    lifeArea: text("life_area"),
    targetDate: timestamp("target_date", { withTimezone: true }),
    metricName: text("metric_name"),
    targetValue: numeric("target_value"),
    currentValue: numeric("current_value"),
    unit: text("unit"),
    status: text("status").default("active"),
    confidence: smallint("confidence"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    hlc: text("hlc"),
    version: smallint("version").default(1)
});

export const goalConfidenceLogs = pgTable("goal_confidence_logs", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    goalId: uuid("goal_id").notNull().references(() => goals.id, { onDelete: "cascade" }),
    loggedOn: timestamp("logged_on", { withTimezone: true }).defaultNow().notNull(),
    confidence: smallint("confidence").notNull(),
    note: text("note"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    hlc: text("hlc"),
    version: smallint("version").default(1)
});

export const objectives = pgTable("objectives", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    goalId: uuid("goal_id").notNull().references(() => goals.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }),
    windowEnd: timestamp("window_end", { withTimezone: true }),
    status: text("status").default("planned"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    hlc: text("hlc"),
    version: smallint("version").default(1)
});

export const roadmaps = pgTable("roadmaps", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    goalId: uuid("goal_id").notNull().references(() => goals.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    generatedBy: text("generated_by"),
    sourceRunId: uuid("source_run_id"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    hlc: text("hlc"),
    version: smallint("version").default(1)
});

export const stages = pgTable("stages", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    roadmapId: uuid("roadmap_id").notNull().references(() => roadmaps.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    ordinal: integer("ordinal").default(0).notNull(),
    targetStart: timestamp("target_start", { withTimezone: true }),
    targetEnd: timestamp("target_end", { withTimezone: true }),
    status: text("status").default("pending"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    hlc: text("hlc"),
    version: smallint("version").default(1)
});

export const milestones = pgTable("milestones", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    stageId: uuid("stage_id").notNull().references(() => stages.id, { onDelete: "cascade" }),
    objectiveId: uuid("objective_id").references(() => objectives.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    definitionOfDone: text("definition_of_done"),
    dueDate: timestamp("due_date", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    estHours: numeric("est_hours"),
    ordinal: integer("ordinal").default(0).notNull(),
    statusOverride: text("status_override"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    hlc: text("hlc"),
    version: smallint("version").default(1)
});

export const milestoneDependencies = pgTable("milestone_dependencies", {
    predecessorId: uuid("predecessor_id").notNull().references(() => milestones.id, { onDelete: "cascade" }),
    successorId: uuid("successor_id").notNull().references(() => milestones.id, { onDelete: "cascade" }),
    kind: text("kind").default("fs"),
}, (t) => [
    primaryKey({ columns: [t.predecessorId, t.successorId] })
]);

// ----------------------------------------------------------------------
// Section 7.2.3: Execution (Tasks, Time, Tags, Habits)
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

export const habits = pgTable("habits", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    cadence: text("cadence").notNull().default("daily"), // daily | weekly | custom
    rrule: text("rrule"),
    targetCount: integer("target_count").default(1),
    unit: text("unit"),
    gracePerWeek: smallint("grace_per_week").default(0),
    active: boolean("active").default(true).notNull(),
    colour: text("colour"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    hlc: text("hlc"),
    version: smallint("version").default(1)
});

export const habitLogs = pgTable("habit_logs", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    habitId: uuid("habit_id").notNull().references(() => habits.id, { onDelete: "cascade" }),
    loggedOn: date("logged_on").notNull(),
    value: numeric("value").default("1"),
    backfilled: boolean("backfilled").default(false).notNull(),
    note: text("note"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    hlc: text("hlc"),
    version: smallint("version").default(1)
}, (t) => [
    unique("habit_logs_user_habit_date_unique").on(t.userId, t.habitId, t.loggedOn)
]);

export const habitPauses = pgTable("habit_pauses", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    habitId: uuid("habit_id").notNull().references(() => habits.id, { onDelete: "cascade" }),
    startOn: date("start_on").notNull(),
    endOn: date("end_on"),
    reason: text("reason"),

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

// ----------------------------------------------------------------------
// Section 7.2.4: Study (Courses, Syllabus, Exams, Study Sessions)
// ----------------------------------------------------------------------

export const courses = pgTable("courses", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    title: text("title").notNull(),
    term: text("term"),
    credits: numeric("credits"),
    instructor: text("instructor"),
    colour: text("colour"),
    targetGrade: text("target_grade"),
    active: boolean("active").default(true).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    hlc: text("hlc"),
    version: smallint("version").default(1)
});

export const syllabusItems = pgTable("syllabus_items", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    ordinal: integer("ordinal").default(0).notNull(),
    scheduledWeek: integer("scheduled_week"),
    coverage: text("coverage").default("not_started").notNull(), // 'not_started' | 'in_progress' | 'covered' | 'revised'
    confidence: smallint("confidence").default(1), // 1-5

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    hlc: text("hlc"),
    version: smallint("version").default(1)
});

export const exams = pgTable("exams", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    venue: text("venue"),
    weight: numeric("weight"),
    rampDays: integer("ramp_days").default(14),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    hlc: text("hlc"),
    version: smallint("version").default(1)
});

export const studySessions = pgTable("study_sessions", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
    syllabusItemId: uuid("syllabus_item_id").references(() => syllabusItems.id, { onDelete: "set null" }),
    plannedMinutes: integer("planned_minutes"),
    actualMinutes: integer("actual_minutes"),
    technique: text("technique"),
    confidenceBefore: smallint("confidence_before"),
    confidenceAfter: smallint("confidence_after"),
    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    hlc: text("hlc"),
    version: smallint("version").default(1)
});

export const courseResources = pgTable("course_resources", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    url: text("url").notNull(),
    resourceType: text("resource_type").default("link"), // 'link' | 'pdf' | 'video'

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    hlc: text("hlc"),
    version: smallint("version").default(1)
});

export const flashcards = pgTable("flashcards", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    courseId: uuid("course_id").notNull().references(() => courses.id, { onDelete: "cascade" }),
    front: text("front").notNull(),
    back: text("back").notNull(),
    nextReviewAt: timestamp("next_review_at", { withTimezone: true }),
    intervalDays: integer("interval_days").default(0),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    hlc: text("hlc"),
    version: smallint("version").default(1)
});


// ----------------------------------------------------------------------
// Section 7.2.5: Notes & Knowledge (Notes, Polymorphic Node Links)
// ----------------------------------------------------------------------

export const notes = pgTable("notes", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("Untitled Note"),
    content: text("content").default(""),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    hlc: text("hlc"),
    version: smallint("version").default(1)
});

export const nodeLinks = pgTable("node_links", {
    sourceNodeId: uuid("source_node_id").notNull().references(() => nodes.id, { onDelete: "cascade" }),
    targetNodeId: uuid("target_node_id").notNull().references(() => nodes.id, { onDelete: "cascade" }),
    kind: text("kind").default("reference"), // 'reference' | 'blocks' | 'relates_to'

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    hlc: text("hlc"),
    version: smallint("version").default(1)
}, (t) => [
    primaryKey({ columns: [t.sourceNodeId, t.targetNodeId] })
]);