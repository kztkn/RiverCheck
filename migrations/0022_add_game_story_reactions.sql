CREATE TABLE game_story_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_story_post_id UUID NOT NULL
    REFERENCES game_story_posts(id) ON DELETE CASCADE,
  group_player_id UUID NOT NULL
    REFERENCES group_players(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT game_story_reactions_type_valid CHECK (
    reaction_type IN ('laugh', 'fire', 'shock', 'nice', 'respect')
  ),
  UNIQUE (game_story_post_id, group_player_id, reaction_type)
);

CREATE INDEX game_story_reactions_post_type_idx
ON game_story_reactions (game_story_post_id, reaction_type);

CREATE INDEX game_story_reactions_player_post_idx
ON game_story_reactions (group_player_id, game_story_post_id);
