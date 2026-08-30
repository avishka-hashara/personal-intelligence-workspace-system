ALTER TABLE "nodes" ADD COLUMN "embedding" vector(1536);--> statement-breakpoint
ALTER TABLE "nodes" ADD COLUMN "embedding_hash" text;--> statement-breakpoint
ALTER TABLE "nodes" ADD COLUMN "embedded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "assistant_name" text DEFAULT 'Copilot';--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "user_name" text;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "memory_summary" text;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "persona_tone" text DEFAULT 'warm';