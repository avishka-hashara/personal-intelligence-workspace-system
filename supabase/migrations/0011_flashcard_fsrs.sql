-- Migration 0011: Add FSRS columns to flashcards table
ALTER TABLE "flashcards"
ADD COLUMN IF NOT EXISTS "stability" numeric,
ADD COLUMN IF NOT EXISTS "difficulty" numeric,
ADD COLUMN IF NOT EXISTS "reps" integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS "lapses" integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS "state" integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS "last_review" timestamp with time zone;
