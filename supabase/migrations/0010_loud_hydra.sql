CREATE TABLE "coaching_nudges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"text" text NOT NULL,
	"cta_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "flashcards" ADD COLUMN "stability" numeric;--> statement-breakpoint
ALTER TABLE "flashcards" ADD COLUMN "difficulty" numeric;--> statement-breakpoint
ALTER TABLE "flashcards" ADD COLUMN "reps" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "flashcards" ADD COLUMN "lapses" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "flashcards" ADD COLUMN "state" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "flashcards" ADD COLUMN "last_review" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "coaching_nudges" ADD CONSTRAINT "coaching_nudges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;