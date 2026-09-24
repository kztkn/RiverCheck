CREATE TABLE group_event_creator_permissions (
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, player_id)
);

CREATE INDEX group_event_creator_permissions_player_idx
  ON group_event_creator_permissions (player_id, group_id);

ALTER TABLE groups
  ADD COLUMN paypay_owner_player_id UUID REFERENCES players(id) ON DELETE SET NULL;

ALTER TABLE games
  ADD COLUMN created_by_player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  ADD COLUMN paypay_recipient_link TEXT,
  ADD COLUMN paypay_link_registered_at TIMESTAMPTZ,
  ADD COLUMN paypay_owner_player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  ADD CONSTRAINT games_paypay_link_metadata_complete CHECK (
    NUM_NONNULLS(paypay_recipient_link, paypay_link_registered_at) IN (0, 2)
  ),
  ADD CONSTRAINT games_paypay_recipient_link_valid CHECK (
    paypay_recipient_link IS NULL OR (
      CHAR_LENGTH(paypay_recipient_link) <= 2048
      AND paypay_recipient_link ~ '^https://[^[:space:]]+$'
    )
  );

UPDATE games AS game
SET paypay_recipient_link = game_group.paypay_recipient_link,
    paypay_link_registered_at = game_group.paypay_link_registered_at,
    paypay_owner_player_id = game_group.paypay_owner_player_id
FROM groups AS game_group
WHERE game_group.id = game.group_id
  AND game_group.paypay_recipient_link IS NOT NULL;

CREATE INDEX games_created_by_player_idx
  ON games (created_by_player_id, played_at DESC);
