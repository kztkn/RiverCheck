INSERT INTO achievements (
  code, name, description, icon_key, category, is_hidden, sort_order
)
VALUES
  ('first-hand', 'ファーストハンド', '初めて開催に参加する', 'badge-check', 'participation', FALSE, 80),
  ('phoenix', '不死鳥', '一度以上リバイした開催で1位になる', 'flame', 'comeback', FALSE, 90),
  ('survivor', '生還', '一度以上リバイした開催をプラス収支で終える', 'trending-up', 'comeback', FALSE, 100),
  ('paid-in-full', '借りたものは返す', 'リバイした開催で、未返済と手元のリバイ証を0にして終了する', 'badge-check', 'rebuy', FALSE, 110),
  ('no-damage', 'ノーダメージ', '3参加開催連続でリバイ0を記録する', 'badge-check', 'streak', FALSE, 120),
  ('three-day-reign', '三日天下', '1位の次の参加開催で最下位になる', 'flame', 'record', FALSE, 130),
  ('giant-killer', '下剋上', '最下位の次の参加開催で1位になる', 'trophy', 'comeback', FALSE, 140),
  ('fourth-place-pro', '4位のプロ', '通算3回、4位になる', 'calendar-check', 'record', FALSE, 150),
  ('silver-collector', '銀メダル収集家', '通算3回、2位になる', 'trophy', 'record', FALSE, 160),
  ('title-defense', '王座防衛', '2参加開催連続で1位になる', 'flame', 'streak', FALSE, 170)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon_key = EXCLUDED.icon_key,
    category = EXCLUDED.category,
    is_hidden = EXCLUDED.is_hidden,
    sort_order = EXCLUDED.sort_order;

CREATE TEMP TABLE evaluated_achievement_codes (
  code TEXT PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO evaluated_achievement_codes (code)
VALUES
  ('first-win'),
  ('three-wins'),
  ('five-games'),
  ('ten-games'),
  ('big-winner'),
  ('hundred-bb'),
  ('first-hand'),
  ('phoenix'),
  ('survivor'),
  ('paid-in-full'),
  ('no-damage'),
  ('three-day-reign'),
  ('giant-killer'),
  ('fourth-place-pro'),
  ('silver-collector'),
  ('title-defense');

CREATE TEMP TABLE recalculated_achievement_unlocks (
  group_player_id UUID NOT NULL,
  code TEXT NOT NULL,
  source_game_id UUID NOT NULL,
  unlocked_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (group_player_id, code)
) ON COMMIT DROP;

WITH result_base AS (
  SELECT
    game_result.group_player_id,
    game_result.game_id,
    game_result.rank,
    COUNT(*) OVER (
      PARTITION BY game_result.game_id
    ) AS participant_count,
    COALESCE(
      game_result.total_rebuy_count,
      game_result.settlement_rebuy_count
    ) AS total_rebuy_count,
    game_result.tracked_outstanding_rebuy_count AS outstanding_rebuy_count,
    game_result.settlement_rebuy_count,
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
    LAG(participant_count) OVER player_history AS previous_participant_count,
    COUNT(*) FILTER (WHERE rank = 1) OVER running_history AS win_number,
    COUNT(*) FILTER (
      WHERE rank = 4 AND participant_count >= 4
    ) OVER running_history AS fourth_place_number,
    COUNT(*) FILTER (WHERE rank = 2) OVER running_history AS second_place_number,
    COUNT(*) FILTER (WHERE total_rebuy_count = 0) OVER (
      PARTITION BY group_player_id
      ORDER BY played_at ASC, unlocked_at ASC, game_id ASC
      ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
    ) AS recent_zero_rebuy_count,
    SUM(net_bb) OVER running_history AS cumulative_net_bb
  FROM result_base
  WINDOW
    player_history AS (
      PARTITION BY group_player_id
      ORDER BY played_at ASC, unlocked_at ASC, game_id ASC
    ),
    running_history AS (
      PARTITION BY group_player_id
      ORDER BY played_at ASC, unlocked_at ASC, game_id ASC
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    )
),
candidates AS (
  SELECT group_player_id, game_id, unlocked_at, game_number, 'first-win'::TEXT AS code
  FROM history
  WHERE rank = 1 AND win_number = 1

  UNION ALL
  SELECT group_player_id, game_id, unlocked_at, game_number, 'three-wins'
  FROM history
  WHERE rank = 1 AND win_number = 3

  UNION ALL
  SELECT group_player_id, game_id, unlocked_at, game_number, 'five-games'
  FROM history
  WHERE game_number = 5

  UNION ALL
  SELECT group_player_id, game_id, unlocked_at, game_number, 'ten-games'
  FROM history
  WHERE game_number = 10

  UNION ALL
  SELECT group_player_id, game_id, unlocked_at, game_number, 'big-winner'
  FROM history
  WHERE net_bb >= 300

  UNION ALL
  SELECT group_player_id, game_id, unlocked_at, game_number, 'hundred-bb'
  FROM history
  WHERE cumulative_net_bb >= 100

  UNION ALL
  SELECT group_player_id, game_id, unlocked_at, game_number, 'first-hand'
  FROM history
  WHERE game_number = 1

  UNION ALL
  SELECT group_player_id, game_id, unlocked_at, game_number, 'phoenix'
  FROM history
  WHERE total_rebuy_count >= 1 AND rank = 1

  UNION ALL
  SELECT group_player_id, game_id, unlocked_at, game_number, 'survivor'
  FROM history
  WHERE total_rebuy_count >= 1 AND net_bb > 0

  UNION ALL
  SELECT group_player_id, game_id, unlocked_at, game_number, 'paid-in-full'
  FROM history
  WHERE total_rebuy_count >= 1
    AND outstanding_rebuy_count = 0
    AND settlement_rebuy_count = 0

  UNION ALL
  SELECT group_player_id, game_id, unlocked_at, game_number, 'no-damage'
  FROM history
  WHERE game_number >= 3 AND recent_zero_rebuy_count = 3

  UNION ALL
  SELECT group_player_id, game_id, unlocked_at, game_number, 'three-day-reign'
  FROM history
  WHERE previous_rank = 1 AND rank = participant_count

  UNION ALL
  SELECT group_player_id, game_id, unlocked_at, game_number, 'giant-killer'
  FROM history
  WHERE previous_rank = previous_participant_count AND rank = 1

  UNION ALL
  SELECT group_player_id, game_id, unlocked_at, game_number, 'fourth-place-pro'
  FROM history
  WHERE rank = 4
    AND participant_count >= 4
    AND fourth_place_number = 3

  UNION ALL
  SELECT group_player_id, game_id, unlocked_at, game_number, 'silver-collector'
  FROM history
  WHERE rank = 2 AND second_place_number = 3

  UNION ALL
  SELECT group_player_id, game_id, unlocked_at, game_number, 'title-defense'
  FROM history
  WHERE previous_rank = 1 AND rank = 1
),
first_candidates AS (
  SELECT DISTINCT ON (group_player_id, code)
    group_player_id,
    code,
    game_id AS source_game_id,
    unlocked_at
  FROM candidates
  ORDER BY group_player_id, code, game_number ASC, game_id ASC
)
INSERT INTO recalculated_achievement_unlocks (
  group_player_id, code, source_game_id, unlocked_at
)
SELECT group_player_id, code, source_game_id, unlocked_at
FROM first_candidates;

UPDATE group_players AS group_player
SET equipped_achievement_id = NULL
FROM achievements AS achievement,
     evaluated_achievement_codes AS evaluated_code
WHERE group_player.equipped_achievement_id = achievement.id
  AND achievement.code = evaluated_code.code
  AND NOT EXISTS (
    SELECT 1
    FROM recalculated_achievement_unlocks AS recalculated
    WHERE recalculated.group_player_id = group_player.id
      AND recalculated.code = achievement.code
  );

DELETE FROM player_achievements AS player_achievement
USING achievements AS achievement,
      evaluated_achievement_codes AS evaluated_code
WHERE player_achievement.achievement_id = achievement.id
  AND achievement.code = evaluated_code.code
  AND NOT EXISTS (
    SELECT 1
    FROM recalculated_achievement_unlocks AS recalculated
    WHERE recalculated.group_player_id = player_achievement.group_player_id
      AND recalculated.code = achievement.code
  );

INSERT INTO player_achievements (
  group_player_id,
  achievement_id,
  unlocked_at,
  source_game_id
)
SELECT
  recalculated.group_player_id,
  achievement.id,
  recalculated.unlocked_at,
  recalculated.source_game_id
FROM recalculated_achievement_unlocks AS recalculated
INNER JOIN achievements AS achievement
  ON achievement.code = recalculated.code
ON CONFLICT (group_player_id, achievement_id) DO UPDATE
SET unlocked_at = EXCLUDED.unlocked_at,
    source_game_id = EXCLUDED.source_game_id;

DELETE FROM player_achievements AS player_achievement
USING achievements AS achievement
WHERE player_achievement.achievement_id = achievement.id
  AND achievement.code = 'back-to-back';

DELETE FROM achievements
WHERE code = 'back-to-back';
