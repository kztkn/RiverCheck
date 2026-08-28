CREATE TABLE game_cost_share_receipts (
  game_id UUID NOT NULL,
  group_player_id UUID NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (game_id, group_player_id),
  FOREIGN KEY (game_id, group_player_id)
    REFERENCES game_participants (game_id, group_player_id)
    ON DELETE CASCADE
);
