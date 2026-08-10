ALTER TABLE game_participants
  RENAME COLUMN rebuy_count TO settlement_rebuy_count;

ALTER TABLE game_participants
  ALTER COLUMN settlement_rebuy_count DROP NOT NULL,
  ALTER COLUMN settlement_rebuy_count DROP DEFAULT;

UPDATE game_participants
SET settlement_rebuy_count = NULL
WHERE remaining_chips IS NULL;

ALTER TABLE game_participants
  ADD COLUMN total_rebuy_count INTEGER,
  ADD COLUMN outstanding_rebuy_count INTEGER NOT NULL DEFAULT 0;

UPDATE game_participants AS participant
SET total_rebuy_count = COALESCE(participant.settlement_rebuy_count, 0),
    outstanding_rebuy_count = COALESCE(participant.settlement_rebuy_count, 0)
FROM games AS game
WHERE game.id = participant.game_id
  AND game.status = 'open';

ALTER TABLE game_participants
  ALTER COLUMN total_rebuy_count SET DEFAULT 0,
  DROP CONSTRAINT game_participants_rebuy_count_non_negative,
  ADD CONSTRAINT game_participants_settlement_rebuy_count_non_negative CHECK (
    settlement_rebuy_count IS NULL OR settlement_rebuy_count >= 0
  ),
  ADD CONSTRAINT game_participants_total_rebuy_count_non_negative CHECK (
    total_rebuy_count IS NULL OR total_rebuy_count >= 0
  ),
  ADD CONSTRAINT game_participants_outstanding_rebuy_count_non_negative CHECK (
    outstanding_rebuy_count >= 0
  ),
  ADD CONSTRAINT game_participants_outstanding_not_above_total CHECK (
    total_rebuy_count IS NULL OR outstanding_rebuy_count <= total_rebuy_count
  );

ALTER TABLE game_results
  RENAME COLUMN rebuy_count TO settlement_rebuy_count;

ALTER TABLE game_results
  ADD COLUMN total_rebuy_count INTEGER,
  ADD COLUMN tracked_outstanding_rebuy_count INTEGER;

ALTER TABLE game_results
  DROP CONSTRAINT game_results_rebuy_count_non_negative,
  ADD CONSTRAINT game_results_settlement_rebuy_count_non_negative CHECK (
    settlement_rebuy_count >= 0
  ),
  ADD CONSTRAINT game_results_total_rebuy_count_non_negative CHECK (
    total_rebuy_count IS NULL OR total_rebuy_count >= 0
  ),
  ADD CONSTRAINT game_results_tracked_outstanding_non_negative CHECK (
    tracked_outstanding_rebuy_count IS NULL OR tracked_outstanding_rebuy_count >= 0
  ),
  ADD CONSTRAINT game_results_settlement_not_above_total CHECK (
    total_rebuy_count IS NULL OR settlement_rebuy_count <= total_rebuy_count
  );

CREATE TABLE game_rebuy_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  command_id UUID NOT NULL UNIQUE,
  game_participant_id UUID NOT NULL
    REFERENCES game_participants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  total_delta INTEGER NOT NULL,
  outstanding_delta INTEGER NOT NULL,
  recorded_by_type TEXT NOT NULL,
  reverts_event_id UUID UNIQUE
    REFERENCES game_rebuy_events(id) ON DELETE CASCADE,
  settlement_before INTEGER,
  settlement_after INTEGER,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT game_rebuy_events_type_valid CHECK (
    event_type IN ('rebuy', 'repayment', 'undo', 'adjustment')
  ),
  CONSTRAINT game_rebuy_events_actor_valid CHECK (
    recorded_by_type IN ('participant', 'organizer')
  ),
  CONSTRAINT game_rebuy_events_settlement_values_valid CHECK (
    (settlement_before IS NULL OR settlement_before >= 0) AND
    (settlement_after IS NULL OR settlement_after >= 0)
  ),
  CONSTRAINT game_rebuy_events_regular_delta_valid CHECK (
    (event_type = 'rebuy' AND total_delta = 1 AND outstanding_delta = 1) OR
    (event_type = 'repayment' AND total_delta = 0 AND outstanding_delta = -1) OR
    event_type IN ('undo', 'adjustment')
  ),
  CONSTRAINT game_rebuy_events_undo_reference_valid CHECK (
    (event_type = 'undo' AND reverts_event_id IS NOT NULL) OR
    (event_type <> 'undo' AND reverts_event_id IS NULL)
  )
);

CREATE INDEX game_rebuy_events_participant_recorded_idx
  ON game_rebuy_events (game_participant_id, recorded_at DESC);
