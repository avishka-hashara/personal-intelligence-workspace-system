CREATE TABLE IF NOT EXISTS sync_ops (
    op_id UUID PRIMARY KEY,
    client_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    op JSONB NOT NULL,
    hlc TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sync_ops_entity_idx ON sync_ops (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS sync_ops_client_idx ON sync_ops (client_id);
CREATE INDEX IF NOT EXISTS sync_ops_hlc_idx ON sync_ops (hlc);
