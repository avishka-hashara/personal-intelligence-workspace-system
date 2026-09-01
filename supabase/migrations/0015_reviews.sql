-- Phase 4: Reviews (Weekly & Quarterly Reviews - AI-08)

CREATE TABLE IF NOT EXISTS reviews (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    period text NOT NULL, -- 'weekly' | 'quarterly'
    period_start timestamptz NOT NULL,
    period_end timestamptz NOT NULL,
    stats jsonb NOT NULL,
    narrative text NOT NULL,
    proposed_adjustments jsonb,
    user_notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    hlc text,
    version smallint DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_reviews_user_period_created ON reviews(user_id, period, created_at DESC);
