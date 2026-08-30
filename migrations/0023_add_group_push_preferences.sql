ALTER TABLE group_players
  ADD COLUMN push_notifications_enabled BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE group_players AS group_player
SET push_notifications_enabled = TRUE
WHERE EXISTS (
  SELECT 1
  FROM player_push_subscriptions AS subscription
  WHERE subscription.player_id = group_player.player_id
);
