-- Migration 0016: time_blocks table for Calendar & Time-Blocking
CREATE TABLE IF NOT EXISTS "time_blocks" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "title" text,
    "start_at" timestamp with time zone NOT NULL,
    "end_at" timestamp with time zone NOT NULL,
    "task_id" uuid REFERENCES "tasks"("id") ON DELETE SET NULL,
    "study_session_id" uuid REFERENCES "study_sessions"("id") ON DELETE SET NULL,
    "kind" text DEFAULT 'work' NOT NULL, -- 'work' | 'study' | 'rest' | 'admin'
    "locked" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    "deleted_at" timestamp with time zone,
    "hlc" text,
    "version" smallint DEFAULT 1
);

CREATE INDEX IF NOT EXISTS "time_blocks_user_time_idx" ON "time_blocks" ("user_id", "start_at", "end_at");
CREATE INDEX IF NOT EXISTS "time_blocks_task_idx" ON "time_blocks" ("task_id");
