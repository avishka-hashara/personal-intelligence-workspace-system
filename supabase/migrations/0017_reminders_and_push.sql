CREATE TABLE IF NOT EXISTS "reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"node_id" uuid REFERENCES "nodes"("id") ON DELETE SET NULL,
	"title" text NOT NULL,
	"fire_at" timestamp with time zone,
	"rrule" text,
	"channel" text[],
	"snooze_until" timestamp with time zone,
	"lead_minutes" integer,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"hlc" text,
	"version" smallint DEFAULT 1
);

CREATE TABLE IF NOT EXISTS "reminder_occurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"reminder_id" uuid NOT NULL REFERENCES "reminders"("id") ON DELETE CASCADE,
	"scheduled_for" timestamp with time zone NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"hlc" text,
	"version" smallint DEFAULT 1
);

CREATE TABLE IF NOT EXISTS "notification_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"occurrence_id" uuid REFERENCES "reminder_occurrences"("id") ON DELETE CASCADE,
	"channel" text DEFAULT 'web_push' NOT NULL,
	"provider_message_id" text,
	"status" text NOT NULL,
	"error" text,
	"attempts" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_reminder_occurrences_due" ON "reminder_occurrences" ("scheduled_for", "state");
CREATE INDEX IF NOT EXISTS "idx_push_subscriptions_user" ON "push_subscriptions" ("user_id");
