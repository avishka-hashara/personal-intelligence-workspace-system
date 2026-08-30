-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding columns to nodes table
ALTER TABLE nodes
  ADD COLUMN IF NOT EXISTS embedding vector(1536),
  ADD COLUMN IF NOT EXISTS embedding_hash text,
  ADD COLUMN IF NOT EXISTS embedded_at timestamptz;

-- Create HNSW cosine distance index
CREATE INDEX IF NOT EXISTS nodes_embedding_hnsw_idx
  ON nodes USING hnsw (embedding vector_cosine_ops);

-- Create user_id index for tenant isolation and fast filtering
CREATE INDEX IF NOT EXISTS nodes_user_id_idx ON nodes (user_id);
