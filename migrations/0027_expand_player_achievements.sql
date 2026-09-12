ALTER TABLE achievements
  DROP CONSTRAINT achievements_icon_key_valid;

ALTER TABLE achievements
  ADD CONSTRAINT achievements_icon_key_valid CHECK (
    icon_key IN (
      'trophy',
      'flame',
      'calendar-check',
      'trending-up',
      'badge-check',
      'cards',
      'bolt',
      'refresh',
      'notes',
      'heart',
      'arrows-up-down'
    )
  );

ALTER TABLE player_achievements
  ADD COLUMN notified_at TIMESTAMPTZ;

-- Existing achievements predate the in-app unlock toast. Mark them as already
-- announced so the first deployment does not replay the entire old collection.
UPDATE player_achievements
SET notified_at = unlocked_at
WHERE notified_at IS NULL;

CREATE INDEX player_achievements_pending_notification_idx
  ON player_achievements (group_player_id, unlocked_at ASC)
  WHERE notified_at IS NULL;

INSERT INTO achievements (
  code, name, description, icon_key, category, is_hidden, sort_order
)
VALUES
  ('seven-deuce-first', '72oデビュー', '72oを初めて成立させる', 'cards', 'table-event', FALSE, 180),
  ('seven-deuce-three', '72o職人', '72oを通算3回成立させる', 'cards', 'table-event', FALSE, 190),
  ('seven-deuce-five', '72oマスター', '72oを通算5回成立させる', 'cards', 'table-event', FALSE, 200),
  ('all-in-five-wins', '勝負師', 'ALL INで通算5回勝つ', 'bolt', 'table-event', FALSE, 210),
  ('all-in-five-losses', '散り際まで美しく', 'ALL INで通算5回負ける', 'bolt', 'table-event', FALSE, 220),
  ('rebuy-ten', '10回目の正直', '通算10回リバイする', 'refresh', 'rebuy', FALSE, 230),
  ('rebuy-triple', '何度でも蘇る', '1開催で3回以上リバイする', 'refresh', 'rebuy', FALSE, 240),
  ('story-first', '記録係', 'TABLE STORIESへ初めて投稿する', 'notes', 'community', FALSE, 250),
  ('story-three', '語り部', 'TABLE STORIESへ通算3回投稿する', 'notes', 'community', FALSE, 260),
  ('story-five', '思い出職人', 'TABLE STORIESへ通算5回投稿する', 'notes', 'community', FALSE, 270),
  ('love-giver', '愛を配る者', '5件のTABLE STORIESへリアクションする', 'heart', 'community', FALSE, 280),
  ('rollercoaster', 'ジェットコースター', '+200BB以上と-200BB以下を両方経験する', 'arrows-up-down', 'record', FALSE, 290)
ON CONFLICT (code) DO NOTHING;

WITH seven_deuce_metrics AS (
  SELECT
    event.game_id,
    event.subject_group_player_id AS group_player_id,
    COUNT(*)::INTEGER AS seven_deuce_count
  FROM game_table_events AS event
  INNER JOIN games AS game ON game.id = event.game_id
  WHERE game.status = 'finalized'
    AND event.event_type = 'seven_deuce'
    AND event.canceled_at IS NULL
    AND event.subject_group_player_id IS NOT NULL
  GROUP BY event.game_id, event.subject_group_player_id
),
all_in_metrics AS (
  SELECT
    event.game_id,
    event_player.group_player_id,
    COUNT(*) FILTER (WHERE event_player.is_winner)::INTEGER AS all_in_win_count,
    COUNT(*) FILTER (WHERE NOT event_player.is_winner)::INTEGER AS all_in_loss_count
  FROM game_table_events AS event
  INNER JOIN games AS game ON game.id = event.game_id
  INNER JOIN game_table_event_players AS event_player
    ON event_player.event_id = event.id
  WHERE game.status = 'finalized'
    AND event.event_type = 'all_in'
    AND event.canceled_at IS NULL
  GROUP BY event.game_id, event_player.group_player_id
),
story_metrics AS (
  SELECT
    participant.game_id,
    participant.group_player_id,
    COUNT(*)::INTEGER AS story_post_count
  FROM game_story_posts AS post
  INNER JOIN game_participants AS participant
    ON participant.id = post.game_participant_id
  INNER JOIN games AS game ON game.id = participant.game_id
  WHERE game.status = 'finalized'
    AND post.deleted_at IS NULL
  GROUP BY participant.game_id, participant.group_player_id
),
result_base AS (
  SELECT
    game_result.group_player_id,
    game_result.game_id,
    game.played_at,
    COALESCE(game.finalized_at, game.updated_at, game.played_at) AS unlocked_at,
    COALESCE(
      game_result.total_rebuy_count,
      game_result.settlement_rebuy_count
    ) AS total_rebuy_count,
    CASE
      WHEN game.initial_chips > 0 THEN
        ((game_result.score - game.initial_chips)::NUMERIC * 100)
          / game.initial_chips
      ELSE 0
    END AS net_bb,
    COALESCE(seven_deuce_metrics.seven_deuce_count, 0) AS seven_deuce_count,
    COALESCE(all_in_metrics.all_in_win_count, 0) AS all_in_win_count,
    COALESCE(all_in_metrics.all_in_loss_count, 0) AS all_in_loss_count,
    COALESCE(story_metrics.story_post_count, 0) AS story_post_count
  FROM game_results AS game_result
  INNER JOIN games AS game ON game.id = game_result.game_id
  LEFT JOIN seven_deuce_metrics
    ON seven_deuce_metrics.game_id = game_result.game_id
   AND seven_deuce_metrics.group_player_id = game_result.group_player_id
  LEFT JOIN all_in_metrics
    ON all_in_metrics.game_id = game_result.game_id
   AND all_in_metrics.group_player_id = game_result.group_player_id
  LEFT JOIN story_metrics
    ON story_metrics.game_id = game_result.game_id
   AND story_metrics.group_player_id = game_result.group_player_id
  WHERE game.status = 'finalized'
),
history AS (
  SELECT
    result_base.*,
    ROW_NUMBER() OVER player_history AS game_number,
    SUM(total_rebuy_count) OVER running_history AS cumulative_rebuys,
    SUM(seven_deuce_count) OVER running_history AS cumulative_seven_deuce,
    SUM(all_in_win_count) OVER running_history AS cumulative_all_in_wins,
    SUM(all_in_loss_count) OVER running_history AS cumulative_all_in_losses,
    SUM(story_post_count) OVER running_history AS cumulative_story_posts,
    MAX(net_bb) OVER running_history AS max_net_bb,
    MIN(net_bb) OVER running_history AS min_net_bb
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
result_candidates AS (
  SELECT group_player_id, game_id, unlocked_at, game_number, 'seven-deuce-first'::TEXT AS code
  FROM history WHERE cumulative_seven_deuce >= 1
  UNION ALL
  SELECT group_player_id, game_id, unlocked_at, game_number, 'seven-deuce-three'
  FROM history WHERE cumulative_seven_deuce >= 3
  UNION ALL
  SELECT group_player_id, game_id, unlocked_at, game_number, 'seven-deuce-five'
  FROM history WHERE cumulative_seven_deuce >= 5
  UNION ALL
  SELECT group_player_id, game_id, unlocked_at, game_number, 'all-in-five-wins'
  FROM history WHERE cumulative_all_in_wins >= 5
  UNION ALL
  SELECT group_player_id, game_id, unlocked_at, game_number, 'all-in-five-losses'
  FROM history WHERE cumulative_all_in_losses >= 5
  UNION ALL
  SELECT group_player_id, game_id, unlocked_at, game_number, 'rebuy-ten'
  FROM history WHERE cumulative_rebuys >= 10
  UNION ALL
  SELECT group_player_id, game_id, unlocked_at, game_number, 'rebuy-triple'
  FROM history WHERE total_rebuy_count >= 3
  UNION ALL
  SELECT group_player_id, game_id, unlocked_at, game_number, 'story-first'
  FROM history WHERE cumulative_story_posts >= 1
  UNION ALL
  SELECT group_player_id, game_id, unlocked_at, game_number, 'story-three'
  FROM history WHERE cumulative_story_posts >= 3
  UNION ALL
  SELECT group_player_id, game_id, unlocked_at, game_number, 'story-five'
  FROM history WHERE cumulative_story_posts >= 5
  UNION ALL
  SELECT group_player_id, game_id, unlocked_at, game_number, 'rollercoaster'
  FROM history WHERE max_net_bb >= 200 AND min_net_bb <= -200
),
first_result_candidates AS (
  SELECT DISTINCT ON (group_player_id, code)
    group_player_id,
    code,
    game_id AS source_game_id,
    unlocked_at
  FROM result_candidates
  ORDER BY group_player_id, code, game_number ASC, game_id ASC
),
reacted_posts AS (
  SELECT
    reaction.group_player_id,
    post.id AS post_id,
    participant.game_id,
    MIN(reaction.created_at) AS first_reacted_at
  FROM game_story_reactions AS reaction
  INNER JOIN game_story_posts AS post
    ON post.id = reaction.game_story_post_id
  INNER JOIN game_participants AS participant
    ON participant.id = post.game_participant_id
  INNER JOIN games AS game ON game.id = participant.game_id
  WHERE game.status = 'finalized'
    AND post.deleted_at IS NULL
  GROUP BY
    reaction.group_player_id,
    post.id,
    participant.game_id
),
ranked_reacted_posts AS (
  SELECT
    reacted_posts.*,
    ROW_NUMBER() OVER (
      PARTITION BY group_player_id
      ORDER BY first_reacted_at ASC, post_id ASC
    ) AS reaction_number
  FROM reacted_posts
),
reaction_candidates AS (
  SELECT
    group_player_id,
    'love-giver'::TEXT AS code,
    game_id AS source_game_id,
    first_reacted_at AS unlocked_at
  FROM ranked_reacted_posts
  WHERE reaction_number = 5
),
all_candidates AS (
  SELECT group_player_id, code, source_game_id, unlocked_at
  FROM first_result_candidates
  UNION ALL
  SELECT group_player_id, code, source_game_id, unlocked_at
  FROM reaction_candidates
)
INSERT INTO player_achievements (
  group_player_id,
  achievement_id,
  unlocked_at,
  source_game_id
)
SELECT
  candidate.group_player_id,
  achievement.id,
  candidate.unlocked_at,
  candidate.source_game_id
FROM all_candidates AS candidate
INNER JOIN achievements AS achievement
  ON achievement.code = candidate.code
ON CONFLICT (group_player_id, achievement_id) DO NOTHING;
