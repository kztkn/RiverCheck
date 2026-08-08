CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  public_code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT groups_public_code_format CHECK (public_code ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT players_display_name_not_blank CHECK (BTRIM(display_name) <> '')
);

CREATE TABLE group_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
  display_name_override TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (group_id, player_id),
  CONSTRAINT group_players_override_not_blank CHECK (
    display_name_override IS NULL OR BTRIM(display_name_override) <> ''
  )
);

CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  played_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  initial_chips BIGINT NOT NULL,
  rebuy_chips BIGINT NOT NULL,
  venue_cost BIGINT NOT NULL,
  rounding_unit BIGINT NOT NULL,
  first_place_cost BIGINT NOT NULL,
  second_place_cost BIGINT NOT NULL,
  third_place_cost BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finalized_at TIMESTAMPTZ,
  CONSTRAINT games_title_not_blank CHECK (BTRIM(title) <> ''),
  CONSTRAINT games_status_valid CHECK (status IN ('draft', 'open', 'finalized')),
  CONSTRAINT games_non_negative_amounts CHECK (
    initial_chips >= 0 AND
    rebuy_chips >= 0 AND
    venue_cost >= 0 AND
    first_place_cost >= 0 AND
    second_place_cost >= 0 AND
    third_place_cost >= 0
  ),
  CONSTRAINT games_positive_rounding_unit CHECK (rounding_unit > 0),
  CONSTRAINT games_fixed_costs_rounded CHECK (
    first_place_cost % rounding_unit = 0 AND
    second_place_cost % rounding_unit = 0 AND
    third_place_cost % rounding_unit = 0
  ),
  CONSTRAINT games_finalized_at_consistent CHECK (
    (status = 'finalized' AND finalized_at IS NOT NULL) OR
    (status <> 'finalized' AND finalized_at IS NULL)
  )
);

CREATE INDEX games_group_played_at_idx ON games (group_id, played_at DESC);

CREATE TABLE game_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  group_player_id UUID NOT NULL REFERENCES group_players(id) ON DELETE RESTRICT,
  participant_token_hash CHAR(64),
  status TEXT NOT NULL DEFAULT 'joined',
  remaining_chips BIGINT,
  rebuy_count INTEGER NOT NULL DEFAULT 0,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (game_id, group_player_id),
  CONSTRAINT game_participants_status_valid CHECK (
    status IN ('joined', 'submitted', 'locked')
  ),
  CONSTRAINT game_participants_remaining_chips_non_negative CHECK (
    remaining_chips IS NULL OR remaining_chips >= 0
  ),
  CONSTRAINT game_participants_rebuy_count_non_negative CHECK (rebuy_count >= 0)
);

CREATE INDEX game_participants_game_idx ON game_participants (game_id);

CREATE TABLE game_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE RESTRICT,
  group_player_id UUID NOT NULL REFERENCES group_players(id) ON DELETE RESTRICT,
  remaining_chips BIGINT NOT NULL,
  rebuy_count INTEGER NOT NULL,
  score BIGINT NOT NULL,
  rank INTEGER NOT NULL,
  cost_share BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (game_id, group_player_id),
  UNIQUE (game_id, rank),
  CONSTRAINT game_results_remaining_chips_non_negative CHECK (remaining_chips >= 0),
  CONSTRAINT game_results_rebuy_count_non_negative CHECK (rebuy_count >= 0),
  CONSTRAINT game_results_rank_positive CHECK (rank > 0),
  CONSTRAINT game_results_cost_share_non_negative CHECK (cost_share >= 0)
);

CREATE INDEX game_results_game_rank_idx ON game_results (game_id, rank);
