-- Additive: one immutable final snapshot per group and season.
CREATE TABLE ranking_seasons (
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE RESTRICT,
  season_key TEXT NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  finalized_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finalized_by TEXT NOT NULL DEFAULT 'ADMIN' CHECK (finalized_by = 'ADMIN'),
  snapshot JSONB NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  PRIMARY KEY (group_id, season_key),
  CHECK (start_at < end_at)
);
