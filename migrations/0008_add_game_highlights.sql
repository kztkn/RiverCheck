ALTER TABLE games
ADD COLUMN highlight_text TEXT,
ADD COLUMN highlight_photo_object_key TEXT,
ADD COLUMN highlight_photo_content_type TEXT,
ADD COLUMN highlight_photo_byte_size INTEGER,
ADD COLUMN highlight_photo_uploaded_at TIMESTAMPTZ,
ADD COLUMN highlight_updated_at TIMESTAMPTZ;

ALTER TABLE games
ADD CONSTRAINT games_highlight_text_length CHECK (
  highlight_text IS NULL OR (
    BTRIM(highlight_text) <> '' AND CHAR_LENGTH(highlight_text) <= 1000
  )
),
ADD CONSTRAINT games_highlight_photo_content_type CHECK (
  highlight_photo_content_type IS NULL OR
  highlight_photo_content_type IN ('image/jpeg', 'image/png', 'image/webp')
),
ADD CONSTRAINT games_highlight_photo_byte_size CHECK (
  highlight_photo_byte_size IS NULL OR
  highlight_photo_byte_size BETWEEN 1 AND 3145728
),
ADD CONSTRAINT games_highlight_photo_metadata_complete CHECK (
  NUM_NONNULLS(
    highlight_photo_object_key,
    highlight_photo_content_type,
    highlight_photo_byte_size,
    highlight_photo_uploaded_at
  ) IN (0, 4)
);

CREATE UNIQUE INDEX games_highlight_photo_object_key_idx
ON games (highlight_photo_object_key)
WHERE highlight_photo_object_key IS NOT NULL;
