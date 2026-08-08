ALTER TABLE players
ADD COLUMN profile_message TEXT,
ADD COLUMN avatar_object_key TEXT,
ADD COLUMN avatar_content_type TEXT,
ADD COLUMN avatar_byte_size INTEGER,
ADD COLUMN avatar_uploaded_at TIMESTAMPTZ,
ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Existing overrides came from the first MVP. Move the effective name to the
-- global player profile, then leave the legacy column empty for compatibility
-- with the Worker version that may still be serving during deployment.
UPDATE players AS player
SET display_name = source.display_name_override,
    updated_at = NOW()
FROM (
  SELECT DISTINCT ON (group_player.player_id)
         group_player.player_id,
         group_player.display_name_override
  FROM group_players AS group_player
  WHERE group_player.display_name_override IS NOT NULL
  ORDER BY group_player.player_id, group_player.created_at DESC
) AS source
WHERE player.id = source.player_id;

UPDATE group_players SET display_name_override = NULL
WHERE display_name_override IS NOT NULL;

ALTER TABLE players
ADD CONSTRAINT players_display_name_length CHECK (
  CHAR_LENGTH(BTRIM(display_name)) BETWEEN 1 AND 40
),
ADD CONSTRAINT players_profile_message_length CHECK (
  profile_message IS NULL OR (
    BTRIM(profile_message) <> '' AND CHAR_LENGTH(profile_message) <= 160
  )
),
ADD CONSTRAINT players_avatar_content_type CHECK (
  avatar_content_type IS NULL OR
  avatar_content_type IN ('image/jpeg', 'image/png', 'image/webp')
),
ADD CONSTRAINT players_avatar_byte_size CHECK (
  avatar_byte_size IS NULL OR avatar_byte_size BETWEEN 1 AND 1048576
),
ADD CONSTRAINT players_avatar_metadata_complete CHECK (
  NUM_NONNULLS(
    avatar_object_key,
    avatar_content_type,
    avatar_byte_size,
    avatar_uploaded_at
  ) IN (0, 4)
);

CREATE UNIQUE INDEX players_avatar_object_key_idx
ON players (avatar_object_key)
WHERE avatar_object_key IS NOT NULL;

CREATE TABLE player_profile_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT player_profile_claims_expiry_after_creation CHECK (
    expires_at > created_at
  )
);

CREATE INDEX player_profile_claims_player_idx
ON player_profile_claims (player_id, created_at DESC);

CREATE TABLE player_profile_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT player_profile_sessions_expiry_after_creation CHECK (
    expires_at > created_at
  )
);

CREATE INDEX player_profile_sessions_player_idx
ON player_profile_sessions (player_id, expires_at DESC)
WHERE revoked_at IS NULL;
