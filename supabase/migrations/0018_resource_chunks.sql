-- Migration 0018: Add Resource Chunks and course_resources indexing columns

ALTER TABLE "course_resources" ADD COLUMN IF NOT EXISTS "page_count" integer;
ALTER TABLE "course_resources" ADD COLUMN IF NOT EXISTS "extracted_chars" integer;
ALTER TABLE "course_resources" ADD COLUMN IF NOT EXISTS "index_status" text DEFAULT 'ready';

CREATE TABLE IF NOT EXISTS "chunks" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "entity_type" text NOT NULL,
    "entity_id" uuid NOT NULL,
    "chunk_index" integer NOT NULL,
    "content" text NOT NULL,
    "context_header" text NOT NULL,
    "token_count" integer NOT NULL,
    "embedding" vector(1536),
    "model_version" text DEFAULT 'text-embedding-3-small' NOT NULL,
    "tsv" tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "chunks_embedding_idx" ON "chunks"
    USING hnsw ("embedding" vector_cosine_ops) WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS "chunks_tsv_idx" ON "chunks" USING gin ("tsv");

CREATE INDEX IF NOT EXISTS "chunks_user_entity_idx" ON "chunks" ("user_id", "entity_type", "entity_id");
