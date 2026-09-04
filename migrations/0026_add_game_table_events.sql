CREATE TABLE game_table_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  command_id UUID NOT NULL UNIQUE,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  subject_group_player_id UUID REFERENCES group_players(id),
  recorded_by_group_player_id UUID REFERENCES group_players(id),
  recorded_by_type TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  canceled_at TIMESTAMPTZ,
  canceled_by_group_player_id UUID REFERENCES group_players(id),
  canceled_by_type TEXT,
  CONSTRAINT game_table_events_type_valid CHECK (
    event_type IN ('seven_deuce', 'bomb_pot', 'all_in')
  ),
  CONSTRAINT game_table_events_actor_valid CHECK (
    recorded_by_type IN ('participant', 'organizer')
  ),
  CONSTRAINT game_table_events_cancel_actor_valid CHECK (
    canceled_by_type IS NULL OR canceled_by_type IN ('participant', 'organizer')
  ),
  CONSTRAINT game_table_events_subject_valid CHECK (
    (event_type = 'seven_deuce' AND subject_group_player_id IS NOT NULL) OR
    (event_type <> 'seven_deuce' AND subject_group_player_id IS NULL)
  ),
  CONSTRAINT game_table_events_cancel_state_valid CHECK (
    (canceled_at IS NULL AND canceled_by_type IS NULL AND canceled_by_group_player_id IS NULL) OR
    (canceled_at IS NOT NULL AND canceled_by_type IS NOT NULL)
  )
);

CREATE TABLE game_table_event_players (
  event_id UUID NOT NULL REFERENCES game_table_events(id) ON DELETE CASCADE,
  group_player_id UUID NOT NULL REFERENCES group_players(id),
  is_winner BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (event_id, group_player_id)
);

CREATE INDEX game_table_events_game_recorded_idx
  ON game_table_events (game_id, recorded_at DESC);

CREATE INDEX game_table_event_players_player_idx
  ON game_table_event_players (group_player_id, event_id);
