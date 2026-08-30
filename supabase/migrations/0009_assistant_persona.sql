-- Migration: Add assistant persona and memory columns to user_settings
ALTER TABLE "user_settings"
ADD COLUMN IF NOT EXISTS "assistant_name" text DEFAULT 'Copilot',
ADD COLUMN IF NOT EXISTS "user_name" text,
ADD COLUMN IF NOT EXISTS "memory_summary" text,
ADD COLUMN IF NOT EXISTS "persona_tone" text DEFAULT 'warm';
