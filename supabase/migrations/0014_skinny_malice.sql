CREATE TABLE "chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"context_header" text NOT NULL,
	"token_count" integer NOT NULL,
	"embedding" vector(1536),
	"model_version" text DEFAULT 'text-embedding-3-small' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "course_resources" ADD COLUMN "page_count" integer;--> statement-breakpoint
ALTER TABLE "course_resources" ADD COLUMN "extracted_chars" integer;--> statement-breakpoint
ALTER TABLE "course_resources" ADD COLUMN "index_status" text DEFAULT 'ready';--> statement-breakpoint
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;