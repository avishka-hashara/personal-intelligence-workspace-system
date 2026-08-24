CREATE TABLE "node_tags" (
	"node_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "node_tags_node_id_tag_id_pk" PRIMARY KEY("node_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "nodes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"title" text,
	"snippet" text,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"colour" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"hlc" text,
	"version" smallint DEFAULT 1
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"notes" text,
	"status" text DEFAULT 'inbox' NOT NULL,
	"priority" smallint DEFAULT 0,
	"due_at" timestamp with time zone,
	"defer_until" timestamp with time zone,
	"estimate_minutes" integer,
	"actual_minutes" integer,
	"rrule" text,
	"recurrence_parent_id" uuid,
	"is_container" boolean DEFAULT false,
	"sort_key" numeric,
	"energy" text,
	"milestone_id" uuid,
	"parent_task_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"hlc" text,
	"version" smallint DEFAULT 1
);
--> statement-breakpoint
ALTER TABLE "user_settings" ALTER COLUMN "version" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "version" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "node_tags" ADD CONSTRAINT "node_tags_node_id_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "node_tags" ADD CONSTRAINT "node_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nodes" ADD CONSTRAINT "nodes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;