CREATE TABLE player_push_subscriptions (
  player_id UUID PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT player_push_subscriptions_endpoint_https CHECK (
    endpoint LIKE 'https://%'
  ),
  CONSTRAINT player_push_subscriptions_endpoint_length CHECK (
    CHAR_LENGTH(endpoint) BETWEEN 1 AND 2048
  ),
  CONSTRAINT player_push_subscriptions_p256dh_length CHECK (
    CHAR_LENGTH(p256dh) BETWEEN 40 AND 256
  ),
  CONSTRAINT player_push_subscriptions_auth_length CHECK (
    CHAR_LENGTH(auth) BETWEEN 16 AND 128
  )
);
