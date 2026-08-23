DO $$
DECLARE
  unmigrated_count BIGINT;
BEGIN
  SELECT COUNT(*)
  INTO unmigrated_count
  FROM games AS game
  WHERE (game.highlight_text IS NOT NULL OR game.highlight_photo_object_key IS NOT NULL)
    AND NOT EXISTS (
      SELECT 1
      FROM game_participants AS participant
      INNER JOIN game_story_posts AS post
        ON post.game_participant_id = participant.id
      WHERE participant.game_id = game.id
        AND post.body IS NOT DISTINCT FROM game.highlight_text
        AND post.photo_object_key IS NOT DISTINCT FROM game.highlight_photo_object_key
        AND post.photo_content_type IS NOT DISTINCT FROM game.highlight_photo_content_type
        AND post.photo_byte_size IS NOT DISTINCT FROM game.highlight_photo_byte_size
        AND post.photo_uploaded_at IS NOT DISTINCT FROM game.highlight_photo_uploaded_at
    );

  IF unmigrated_count > 0 THEN
    RAISE EXCEPTION
      '% legacy game highlight(s) have not been migrated to game_story_posts',
      unmigrated_count;
  END IF;
END
$$;

DROP INDEX IF EXISTS games_highlight_photo_object_key_idx;

ALTER TABLE games
  DROP CONSTRAINT IF EXISTS games_highlight_text_length,
  DROP CONSTRAINT IF EXISTS games_highlight_photo_content_type,
  DROP CONSTRAINT IF EXISTS games_highlight_photo_byte_size,
  DROP CONSTRAINT IF EXISTS games_highlight_photo_metadata_complete,
  DROP COLUMN highlight_text,
  DROP COLUMN highlight_photo_object_key,
  DROP COLUMN highlight_photo_content_type,
  DROP COLUMN highlight_photo_byte_size,
  DROP COLUMN highlight_photo_uploaded_at,
  DROP COLUMN highlight_updated_at;
