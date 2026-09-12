ALTER TABLE group_players
ADD COLUMN achievements_dirty BOOLEAN NOT NULL DEFAULT FALSE;

-- Repair unlocks that may have been missed by the previous background refresh.
-- Each existing finalized player is recalculated once on the next collection read.
UPDATE group_players AS group_player
SET achievements_dirty = TRUE
WHERE EXISTS (
  SELECT 1
  FROM game_results AS game_result
  INNER JOIN games AS game ON game.id = game_result.game_id
  WHERE game_result.group_player_id = group_player.id
    AND game.group_id = group_player.group_id
    AND game.status = 'finalized'
);
