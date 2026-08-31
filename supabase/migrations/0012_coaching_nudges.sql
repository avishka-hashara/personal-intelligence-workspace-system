-- Migration 0012: Create coaching_nudges table
CREATE TABLE IF NOT EXISTS "coaching_nudges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"text" text NOT NULL,
	"cta_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
