CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon_key TEXT NOT NULL,
  category TEXT NOT NULL,
  is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT achievements_code_format CHECK (code ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  CONSTRAINT achievements_name_not_blank CHECK (BTRIM(name) <> ''),
  CONSTRAINT achievements_description_not_blank CHECK (BTRIM(description) <> ''),
  CONSTRAINT achievements_icon_key_valid CHECK (
    icon_key IN ('trophy', 'flame', 'calendar-check', 'trending-up', 'badge-check')
  )
);

CREATE TABLE player_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_player_id UUID NOT NULL REFERENCES group_players(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE RESTRICT,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_game_id UUID REFERENCES games(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  UNIQUE (group_player_id, achievement_id)
);

CREATE INDEX player_achievements_group_player_idx
  ON player_achievements (group_player_id, unlocked_at DESC);

ALTER TABLE group_players
  ADD COLUMN equipped_achievement_id UUID
  REFERENCES achievements(id) ON DELETE SET NULL;

INSERT INTO achievements (
  code, name, description, icon_key, category, is_hidden, sort_order
)
VALUES
  ('first-win', '初戴冠', '初めて1位を獲得', 'trophy', 'victory', FALSE, 10),
  ('back-to-back', 'Back to Back', '2開催連続優勝', 'flame', 'streak', FALSE, 20),
  ('three-wins', 'またお前か', '通算3回優勝', 'badge-check', 'victory', FALSE, 30),
  ('five-games', 'いつメン', '5開催に参加', 'calendar-check', 'participation', FALSE, 40),
  ('ten-games', 'テーブルの主', '10開催に参加', 'calendar-check', 'participation', FALSE, 50),
  ('big-winner', '一撃必殺', '1開催で+300BB以上を記録', 'trending-up', 'performance', FALSE, 60),
  ('hundred-bb', 'ダイヤの原石', '累計損益+100BBを達成', 'trending-up', 'performance', FALSE, 70);

-- Existing finalized results are evaluated once so deployment does not leave
-- established players with an empty collection. Future unlocks are awarded by
-- AchievementService in the finalize/correction transaction.
WITH result_base AS (
  SELECT
    game_result.group_player_id,
    game_result.game_id,
    game_result.rank,
    game.played_at,
    COALESCE(game.finalized_at, game.updated_at, game.played_at) AS unlocked_at,
    CASE
      WHEN game.initial_chips > 0 THEN
        ((game_result.score - game.initial_chips)::NUMERIC * 100)
          / game.initial_chips
      ELSE 0
    END AS net_bb
  FROM game_results AS game_result
  INNER JOIN games AS game ON game.id = game_result.game_id
  WHERE game.status = 'finalized'
),
history AS (
  SELECT
    result_base.*,
    ROW_NUMBER() OVER player_history AS game_number,
    LAG(rank) OVER player_history AS previous_rank,
    COUNT(*) FILTER (WHERE rank = 1) OVER (
      PARTITION BY group_player_id
      ORDER BY played_at ASC, unlocked_at ASC, game_id ASC
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS win_number,
    SUM(net_bb) OVER (
      PARTITION BY group_player_id
      ORDER BY played_at ASC, unlocked_at ASC, game_id ASC
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS cumulative_net_bb
  FROM result_base
  WINDOW player_history AS (
    PARTITION BY group_player_id
    ORDER BY played_at ASC, unlocked_at ASC, game_id ASC
  )
),
candidates AS (
  SELECT group_player_id, game_id, unlocked_at, 'first-win'::TEXT AS code
  FROM history WHERE rank = 1 AND win_number = 1
  UNION ALL
  SELECT group_player_id, game_id, unlocked_at, 'back-to-back'
  FROM history WHERE rank = 1 AND previous_rank = 1
  UNION ALL
  SELECT group_player_id, game_id, unlocked_at, 'three-wins'
  FROM history WHERE rank = 1 AND win_number = 3
  UNION ALL
  SELECT group_player_id, game_id, unlocked_at, 'five-games'
  FROM history WHERE game_number = 5
  UNION ALL
  SELECT group_player_id, game_id, unlocked_at, 'ten-games'
  FROM history WHERE game_number = 10
  UNION ALL
  SELECT group_player_id, game_id, unlocked_at, 'big-winner'
  FROM history WHERE net_bb >= 300
  UNION ALL
  SELECT group_player_id, game_id, unlocked_at, 'hundred-bb'
  FROM history WHERE cumulative_net_bb >= 100
),
first_candidates AS (
  SELECT DISTINCT ON (group_player_id, code)
    group_player_id, game_id, unlocked_at, code
  FROM candidates
  ORDER BY group_player_id, code, unlocked_at ASC, game_id ASC
)
INSERT INTO player_achievements (
  group_player_id, achievement_id, unlocked_at, source_game_id
)
SELECT
  first_candidate.group_player_id,
  achievement.id,
  first_candidate.unlocked_at,
  first_candidate.game_id
FROM first_candidates AS first_candidate
INNER JOIN achievements AS achievement ON achievement.code = first_candidate.code
ON CONFLICT (group_player_id, achievement_id) DO NOTHING;
