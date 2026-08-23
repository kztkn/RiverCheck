CREATE TABLE game_story_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_participant_id UUID NOT NULL UNIQUE
    REFERENCES game_participants(id) ON DELETE CASCADE,
  body TEXT,
  photo_object_key TEXT,
  photo_content_type TEXT,
  photo_byte_size INTEGER,
  photo_uploaded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  deleted_by_type TEXT,
  CONSTRAINT game_story_posts_body_length CHECK (
    body IS NULL OR (
      BTRIM(body) <> '' AND CHAR_LENGTH(body) <= 160
    )
  ),
  CONSTRAINT game_story_posts_photo_content_type CHECK (
    photo_content_type IS NULL OR
    photo_content_type IN ('image/jpeg', 'image/png', 'image/webp')
  ),
  CONSTRAINT game_story_posts_photo_byte_size CHECK (
    photo_byte_size IS NULL OR photo_byte_size BETWEEN 1 AND 3145728
  ),
  CONSTRAINT game_story_posts_photo_metadata_complete CHECK (
    NUM_NONNULLS(
      photo_object_key,
      photo_content_type,
      photo_byte_size,
      photo_uploaded_at
    ) IN (0, 4)
  ),
  CONSTRAINT game_story_posts_content_present CHECK (
    deleted_at IS NOT NULL OR body IS NOT NULL OR photo_object_key IS NOT NULL
  ),
  CONSTRAINT game_story_posts_deleted_by_valid CHECK (
    (deleted_at IS NULL AND deleted_by_type IS NULL) OR
    (deleted_at IS NOT NULL AND deleted_by_type = 'organizer')
  )
);

CREATE INDEX game_story_posts_participant_idx
ON game_story_posts (game_participant_id);

CREATE UNIQUE INDEX game_story_posts_photo_object_key_idx
ON game_story_posts (photo_object_key)
WHERE photo_object_key IS NOT NULL;
