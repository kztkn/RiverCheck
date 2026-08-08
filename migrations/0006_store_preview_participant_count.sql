ALTER TABLE games
ADD COLUMN preview_participant_count INTEGER;

UPDATE games AS game
SET preview_participant_count = GREATEST(
  4,
  (
    SELECT COUNT(*)::INTEGER
    FROM game_participants AS participant
    WHERE participant.game_id = game.id
  )
);

ALTER TABLE games
ALTER COLUMN preview_participant_count SET DEFAULT 8,
ALTER COLUMN preview_participant_count SET NOT NULL;

ALTER TABLE games
ADD CONSTRAINT games_preview_participant_count_valid CHECK (
  preview_participant_count >= 4
);
