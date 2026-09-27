import { queryDatabase } from "@server/db/client.server";
import type { AchievementIconKey } from "@shared-types/achievement";
import type {
  YearRecapAchievement,
  YearRecapResultSource,
  YearRecapStoryStats,
} from "@shared-types/year-recap";

interface RecapResultRow {
  game_id: string;
  game_title: string;
  played_at: Date;
  group_player_id: string;
  display_name: string;
  avatar_uploaded_at: Date | null;
  rank: number;
  total_rebuy_count: number;
  net_bb: string | null;
}

interface StoryStatsRow {
  posts_created: number;
  reactions_received: number;
  reacted_post_count: number;
}

interface AchievementRow {
  id: string;
  name: string;
  icon_key: AchievementIconKey;
  unlocked_at: Date;
}

export async function listYearRecapResults(
  groupId: string,
  startAt: string,
  endAt: string,
): Promise<YearRecapResultSource[]> {
  const result = await queryDatabase<RecapResultRow>(
    `
      SELECT
        game.id AS game_id,
        game.title AS game_title,
        game.played_at,
        game_result.group_player_id,
        player.display_name,
        player.avatar_uploaded_at,
        game_result.rank,
        COALESCE(
          game_result.total_rebuy_count,
          game_result.settlement_rebuy_count,
          0
        )::INTEGER AS total_rebuy_count,
        CASE
          WHEN COALESCE(
            game.big_blind_chips::NUMERIC,
            game.initial_chips::NUMERIC / NULLIF(game.initial_stack_bb, 0)
          ) > 0 THEN
            (game_result.score - game.initial_chips)::NUMERIC
              / COALESCE(
                  game.big_blind_chips::NUMERIC,
                  game.initial_chips::NUMERIC / NULLIF(game.initial_stack_bb, 0)
                )
          ELSE NULL
        END AS net_bb
      FROM game_results AS game_result
      INNER JOIN games AS game ON game.id = game_result.game_id
      INNER JOIN group_players AS group_player
        ON group_player.id = game_result.group_player_id
      INNER JOIN players AS player ON player.id = group_player.player_id
      WHERE game.group_id = $1
        AND game.status = 'finalized'
        AND game.played_at >= $2::TIMESTAMPTZ
        AND game.played_at < $3::TIMESTAMPTZ
      ORDER BY game.played_at ASC, game.id ASC, game_result.rank ASC
    `,
    [groupId, startAt, endAt],
  );

  if (result.rows.some((row) => row.net_bb === null)) {
    throw new Error("年間まとめに損益BBを算出できない確定済み開催があります");
  }

  return result.rows.map((row) => ({
    gameId: row.game_id,
    gameTitle: row.game_title,
    playedAt: row.played_at.toISOString(),
    groupPlayerId: row.group_player_id,
    displayName: row.display_name,
    avatarUpdatedAt: row.avatar_uploaded_at?.toISOString() ?? null,
    rank: row.rank,
    totalRebuyCount: row.total_rebuy_count,
    netBb: Number(row.net_bb),
  }));
}

export async function findYearRecapStoryStats(
  groupId: string,
  groupPlayerId: string,
  startAt: string,
  endAt: string,
): Promise<YearRecapStoryStats> {
  const result = await queryDatabase<StoryStatsRow>(
    `
      WITH year_posts AS (
        SELECT story.id, participant.group_player_id
        FROM game_story_posts AS story
        INNER JOIN game_participants AS participant
          ON participant.id = story.game_participant_id
        INNER JOIN games AS game ON game.id = participant.game_id
        WHERE game.group_id = $1
          AND game.played_at >= $3::TIMESTAMPTZ
          AND game.played_at < $4::TIMESTAMPTZ
          AND story.deleted_at IS NULL
      )
      SELECT
        COUNT(DISTINCT year_post.id) FILTER (
          WHERE year_post.group_player_id = $2
        )::INTEGER AS posts_created,
        COUNT(reaction.id) FILTER (
          WHERE year_post.group_player_id = $2
        )::INTEGER AS reactions_received,
        COUNT(DISTINCT reaction.game_story_post_id) FILTER (
          WHERE reaction.group_player_id = $2
        )::INTEGER AS reacted_post_count
      FROM year_posts AS year_post
      LEFT JOIN game_story_reactions AS reaction
        ON reaction.game_story_post_id = year_post.id
    `,
    [groupId, groupPlayerId, startAt, endAt],
  );
  const row = result.rows[0];
  return {
    postsCreated: row?.posts_created ?? 0,
    reactionsReceived: row?.reactions_received ?? 0,
    reactedPostCount: row?.reacted_post_count ?? 0,
  };
}

export async function listYearRecapAchievements(
  groupId: string,
  groupPlayerId: string,
  startAt: string,
  endAt: string,
): Promise<YearRecapAchievement[]> {
  const result = await queryDatabase<AchievementRow>(
    `
      SELECT
        achievement.id,
        achievement.name,
        achievement.icon_key,
        player_achievement.unlocked_at
      FROM player_achievements AS player_achievement
      INNER JOIN group_players AS group_player
        ON group_player.id = player_achievement.group_player_id
      INNER JOIN achievements AS achievement
        ON achievement.id = player_achievement.achievement_id
      WHERE group_player.group_id = $1
        AND group_player.id = $2
        AND player_achievement.unlocked_at >= $3::TIMESTAMPTZ
        AND player_achievement.unlocked_at < $4::TIMESTAMPTZ
      ORDER BY player_achievement.unlocked_at ASC, achievement.sort_order ASC
    `,
    [groupId, groupPlayerId, startAt, endAt],
  );
  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    iconKey: row.icon_key,
    unlockedAt: row.unlocked_at.toISOString(),
  }));
}
