ALTER TABLE games ADD COLUMN table_management_started_at TIMESTAMPTZ;

ALTER TABLE game_participants
  ADD COLUMN table_position TEXT NOT NULL DEFAULT 'MAIN',
  ADD COLUMN sub_entered_at TIMESTAMPTZ,
  ADD CONSTRAINT game_participants_table_position_valid CHECK (
    (table_position = 'MAIN' AND sub_entered_at IS NULL) OR
    (table_position = 'SUB' AND sub_entered_at IS NOT NULL)
  );

CREATE TABLE game_table_moves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  command_id UUID NOT NULL UNIQUE,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  group_player_id UUID NOT NULL REFERENCES group_players(id),
  from_table TEXT NOT NULL CHECK (from_table IN ('MAIN', 'SUB')),
  to_table TEXT NOT NULL CHECK (to_table IN ('MAIN', 'SUB')),
  recorded_at TIMESTAMPTZ NOT NULL,
  recorded_by_player_id UUID REFERENCES players(id),
  CHECK (from_table <> to_table)
);

CREATE INDEX game_table_moves_game_recorded_idx
  ON game_table_moves (game_id, recorded_at DESC, id DESC);
