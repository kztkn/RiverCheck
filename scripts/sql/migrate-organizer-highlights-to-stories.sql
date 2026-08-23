-- One-time production data migration.
-- Run this manually after deploying the application version that no longer
-- reads games.highlight_* and before applying migration 0018.
--
-- This script intentionally aborts instead of overwriting data when:
--   * the organizer player does not exist;
--   * the organizer did not participate in a highlighted game;
--   * the organizer already has a TABLE STORIES post for that game; or
--   * a legacy highlight exceeds the 160-character story limit.

BEGIN;

CREATE TEMPORARY TABLE organizer_highlight_migration_config (
  player_id UUID PRIMARY KEY
) ON COMMIT DROP;

-- Replace this placeholder with the organizer's player ID before execution.
INSERT INTO organizer_highlight_migration_config (player_id)
VALUES ('00000000-0000-0000-0000-000000000000');

DO $$
DECLARE
  organizer_player_id UUID;
  conflict_count BIGINT;
BEGIN
  SELECT player_id
  INTO STRICT organizer_player_id
  FROM organizer_highlight_migration_config;

  IF NOT EXISTS (
    SELECT 1
    FROM players
    WHERE id = organizer_player_id
  ) THEN
    RAISE EXCEPTION 'Organizer player % was not found', organizer_player_id;
  END IF;

  SELECT COUNT(*)
  INTO conflict_count
  FROM games AS game
  WHERE (game.highlight_text IS NOT NULL OR game.highlight_photo_object_key IS NOT NULL)
    AND NOT EXISTS (
      SELECT 1
      FROM group_players AS group_player
      INNER JOIN game_participants AS participant
        ON participant.group_player_id = group_player.id
       AND participant.game_id = game.id
      WHERE group_player.group_id = game.group_id
        AND group_player.player_id = organizer_player_id
    );

  IF conflict_count > 0 THEN
    RAISE EXCEPTION
      '% highlighted game(s) do not contain the organizer as a participant',
      conflict_count;
  END IF;

  SELECT COUNT(*)
  INTO conflict_count
  FROM games AS game
  INNER JOIN group_players AS group_player
    ON group_player.group_id = game.group_id
   AND group_player.player_id = organizer_player_id
  INNER JOIN game_participants AS participant
    ON participant.game_id = game.id
   AND participant.group_player_id = group_player.id
  INNER JOIN game_story_posts AS post
    ON post.game_participant_id = participant.id
  WHERE game.highlight_text IS NOT NULL
     OR game.highlight_photo_object_key IS NOT NULL;

  IF conflict_count > 0 THEN
    RAISE EXCEPTION
      '% highlighted game(s) already have an organizer TABLE STORIES post; no data was changed',
      conflict_count;
  END IF;

  SELECT COUNT(*)
  INTO conflict_count
  FROM games AS game
  WHERE game.highlight_text IS NOT NULL
    AND CHAR_LENGTH(game.highlight_text) > 160;

  IF conflict_count > 0 THEN
    RAISE EXCEPTION
      '% legacy highlight(s) exceed the 160-character TABLE STORIES limit',
      conflict_count;
  END IF;
END
$$;

INSERT INTO game_story_posts (
  game_participant_id,
  body,
  photo_object_key,
  photo_content_type,
  photo_byte_size,
  photo_uploaded_at,
  created_at,
  updated_at
)
SELECT
  participant.id,
  game.highlight_text,
  game.highlight_photo_object_key,
  game.highlight_photo_content_type,
  game.highlight_photo_byte_size,
  game.highlight_photo_uploaded_at,
  COALESCE(
    game.highlight_updated_at,
    game.highlight_photo_uploaded_at,
    game.finalized_at,
    game.updated_at
  ),
  COALESCE(
    game.highlight_updated_at,
    game.highlight_photo_uploaded_at,
    game.finalized_at,
    game.updated_at
  )
FROM games AS game
INNER JOIN group_players AS group_player
  ON group_player.group_id = game.group_id
 AND group_player.player_id = (
   SELECT player_id FROM organizer_highlight_migration_config
 )
INNER JOIN game_participants AS participant
  ON participant.game_id = game.id
 AND participant.group_player_id = group_player.id
WHERE game.highlight_text IS NOT NULL
   OR game.highlight_photo_object_key IS NOT NULL
ORDER BY game.played_at, game.id;

DO $$
DECLARE
  legacy_count BIGINT;
  migrated_count BIGINT;
  organizer_player_id UUID;
BEGIN
  SELECT player_id
  INTO STRICT organizer_player_id
  FROM organizer_highlight_migration_config;

  SELECT COUNT(*)
  INTO legacy_count
  FROM games
  WHERE highlight_text IS NOT NULL
     OR highlight_photo_object_key IS NOT NULL;

  SELECT COUNT(*)
  INTO migrated_count
  FROM games AS game
  INNER JOIN group_players AS group_player
    ON group_player.group_id = game.group_id
   AND group_player.player_id = organizer_player_id
  INNER JOIN game_participants AS participant
    ON participant.game_id = game.id
   AND participant.group_player_id = group_player.id
  INNER JOIN game_story_posts AS post
    ON post.game_participant_id = participant.id
  WHERE game.highlight_text IS NOT DISTINCT FROM post.body
    AND game.highlight_photo_object_key IS NOT DISTINCT FROM post.photo_object_key
    AND game.highlight_photo_content_type IS NOT DISTINCT FROM post.photo_content_type
    AND game.highlight_photo_byte_size IS NOT DISTINCT FROM post.photo_byte_size
    AND game.highlight_photo_uploaded_at IS NOT DISTINCT FROM post.photo_uploaded_at;

  IF migrated_count <> legacy_count THEN
    RAISE EXCEPTION
      'Verification failed: % legacy highlight(s), % matching story post(s)',
      legacy_count,
      migrated_count;
  END IF;

  RAISE NOTICE 'Migrated and verified % organizer highlight(s)', migrated_count;
END
$$;

COMMIT;
