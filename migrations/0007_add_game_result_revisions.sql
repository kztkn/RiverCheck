CREATE TABLE game_result_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE RESTRICT,
  revision_number INTEGER NOT NULL,
  before_results JSONB NOT NULL,
  after_results JSONB NOT NULL,
  corrected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (game_id, revision_number),
  CONSTRAINT game_result_revisions_number_positive CHECK (
    revision_number > 0
  ),
  CONSTRAINT game_result_revisions_before_array CHECK (
    JSONB_TYPEOF(before_results) = 'array'
  ),
  CONSTRAINT game_result_revisions_after_array CHECK (
    JSONB_TYPEOF(after_results) = 'array'
  )
);

CREATE INDEX game_result_revisions_game_number_idx
ON game_result_revisions (game_id, revision_number DESC);
