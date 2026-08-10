import { queryDatabase } from "@server/db/client.server";
import type {
  PlayerStatsRankingRow,
  PlayerStatsSort,
} from "@shared-types/player-stats";
import type { AchievementIconKey } from "@shared-types/achievement";

interface RankingRow {
  leaderboard_rank: string;
  group_player_id: string;
  display_name: string;
  games_played: number;
  wins: number;
  top_three_finishes: number;
  total_net_bb: string;
  average_net_bb: string;
  max_win_bb: string;
  max_loss_bb: string;
  recent_average_net_bb: string;
  recent_game_count: number;
  average_rank_rate: string | null;
  invalid_initial_chips_count: number;
  avatar_uploaded_at: Date | null;
  achievement_id: string | null;
  achievement_code: string | null;
  achievement_name: string | null;
  achievement_description: string | null;
  achievement_icon_key: AchievementIconKey | null;
  achievement_category: string | null;
}

interface PlayerIdentityRow {
  group_player_id: string;
  display_name: string;
  profile_message: string | null;
  favorite_hand_card_1: string | null;
  favorite_hand_card_2: string | null;
  avatar_uploaded_at: Date | null;
}

interface PlayerGameStatRow {
  game_id: string;
  game_title: string;
  played_at: Date;
  rank: number;
  rebuy_count: number;
  net_bb: string | null;
  initial_chips: string;
}

export interface PlayerStatsIdentity {
  groupPlayerId: string;
  displayName: string;
  profileMessage: string | null;
  favoriteCard1: string | null;
  favoriteCard2: string | null;
  avatarUpdatedAt: string | null;
}

export interface FinalizedPlayerGameStat {
  gameId: string;
  gameTitle: string;
  playedAt: string;
  rank: number;
  rebuyCount: number;
  netBb: number;
}

export async function listPlayerStatsRanking(
  groupId: string,
  sort: PlayerStatsSort,
): Promise<PlayerStatsRankingRow[]> {
  const orderExpressions = {
    total: "total_net_bb DESC, average_net_bb DESC",
    average: "average_net_bb DESC, total_net_bb DESC",
    "max-win": "max_win_bb DESC, total_net_bb DESC",
    "max-loss": "max_loss_bb ASC, total_net_bb DESC",
    recent: "recent_average_net_bb DESC, total_net_bb DESC",
    "top-three": "top_three_finishes DESC, wins DESC, total_net_bb DESC",
    "rank-rate": "average_rank_rate ASC NULLS LAST, total_net_bb DESC",
  } satisfies Record<PlayerStatsSort, string>;
  const orderExpression = orderExpressions[sort];

  const result = await queryDatabase<RankingRow>(
    `
      WITH finalized_results AS (
        SELECT
          game_result.game_id,
          game_result.group_player_id,
          game_result.rank,
          game.initial_chips,
          COUNT(*) OVER (
            PARTITION BY game_result.game_id
          )::INTEGER AS participant_count,
          ROW_NUMBER() OVER (
            PARTITION BY game_result.group_player_id
            ORDER BY game.played_at DESC, game.finalized_at DESC, game.id DESC
          ) AS recent_number,
          CASE
            WHEN game.initial_chips > 0 THEN
              ((game_result.score - game.initial_chips)::NUMERIC * 100)
                / game.initial_chips
            ELSE NULL
          END AS net_bb
        FROM game_results AS game_result
        INNER JOIN games AS game ON game.id = game_result.game_id
        WHERE game.group_id = $1
          AND game.status = 'finalized'
      ),
      player_aggregates AS (
        SELECT
          group_player.id AS group_player_id,
          player.display_name,
          player.avatar_uploaded_at,
          equipped_achievement.id AS achievement_id,
          equipped_achievement.code AS achievement_code,
          equipped_achievement.name AS achievement_name,
          equipped_achievement.description AS achievement_description,
          equipped_achievement.icon_key AS achievement_icon_key,
          equipped_achievement.category AS achievement_category,
          COUNT(finalized_result.game_id)::INTEGER AS games_played,
          COUNT(finalized_result.game_id)
            FILTER (WHERE finalized_result.rank = 1)::INTEGER AS wins,
          COUNT(finalized_result.game_id)
            FILTER (WHERE finalized_result.rank <= 3)::INTEGER
            AS top_three_finishes,
          COALESCE(SUM(finalized_result.net_bb), 0) AS total_net_bb,
          COALESCE(AVG(finalized_result.net_bb), 0) AS average_net_bb,
          COALESCE(
            MAX(finalized_result.net_bb)
              FILTER (WHERE finalized_result.net_bb > 0),
            0
          ) AS max_win_bb,
          COALESCE(
            MIN(finalized_result.net_bb)
              FILTER (WHERE finalized_result.net_bb < 0),
            0
          ) AS max_loss_bb,
          COALESCE(
            AVG(finalized_result.net_bb)
              FILTER (WHERE finalized_result.recent_number <= 3),
            0
          ) AS recent_average_net_bb,
          COUNT(finalized_result.game_id)
            FILTER (WHERE finalized_result.recent_number <= 3)::INTEGER
            AS recent_game_count,
          AVG(
            finalized_result.rank::NUMERIC
              / NULLIF(finalized_result.participant_count, 0)
          ) * 100 AS average_rank_rate,
          COUNT(finalized_result.game_id)
            FILTER (WHERE finalized_result.initial_chips <= 0)::INTEGER
            AS invalid_initial_chips_count
        FROM group_players AS group_player
        INNER JOIN players AS player ON player.id = group_player.player_id
        LEFT JOIN player_achievements AS equipped_unlock
          ON equipped_unlock.group_player_id = group_player.id
         AND equipped_unlock.achievement_id = group_player.equipped_achievement_id
        LEFT JOIN achievements AS equipped_achievement
          ON equipped_achievement.id = equipped_unlock.achievement_id
        LEFT JOIN finalized_results AS finalized_result
          ON finalized_result.group_player_id = group_player.id
        WHERE group_player.group_id = $1
        GROUP BY group_player.id, player.display_name, player.avatar_uploaded_at,
                 equipped_achievement.id, equipped_achievement.code,
                 equipped_achievement.name, equipped_achievement.description,
                 equipped_achievement.icon_key, equipped_achievement.category
      ),
      ranked_players AS (
        SELECT
          RANK() OVER (ORDER BY ${orderExpression}) AS leaderboard_rank,
          *
        FROM player_aggregates
      )
      SELECT
        leaderboard_rank,
        group_player_id,
        display_name,
        games_played,
        wins,
        top_three_finishes,
        total_net_bb,
        average_net_bb,
        max_win_bb,
        max_loss_bb,
        recent_average_net_bb,
        recent_game_count,
        average_rank_rate,
        invalid_initial_chips_count,
        avatar_uploaded_at,
        achievement_id,
        achievement_code,
        achievement_name,
        achievement_description,
        achievement_icon_key,
        achievement_category
      FROM ranked_players
      ORDER BY leaderboard_rank ASC, display_name ASC
    `,
    [groupId],
  );

  assertValidInitialChips(
    result.rows.reduce(
      (total, row) => total + row.invalid_initial_chips_count,
      0,
    ),
  );

  return result.rows.map((row) => ({
    rank: Number(row.leaderboard_rank),
    groupPlayerId: row.group_player_id,
    displayName: row.display_name,
    gamesPlayed: row.games_played,
    wins: row.wins,
    topThreeFinishes: row.top_three_finishes,
    totalNetBb: Number(row.total_net_bb),
    averageNetBb: Number(row.average_net_bb),
    maxWinBb: Number(row.max_win_bb),
    maxLossBb: Number(row.max_loss_bb),
    recentAverageNetBb: Number(row.recent_average_net_bb),
    recentGameCount: row.recent_game_count,
    averageRankRate:
      row.average_rank_rate === null ? null : Number(row.average_rank_rate),
    avatarUpdatedAt: row.avatar_uploaded_at?.toISOString() ?? null,
    equippedAchievement:
      row.achievement_id &&
      row.achievement_code &&
      row.achievement_name &&
      row.achievement_description &&
      row.achievement_icon_key &&
      row.achievement_category
        ? {
            id: row.achievement_id,
            code: row.achievement_code,
            name: row.achievement_name,
            description: row.achievement_description,
            iconKey: row.achievement_icon_key,
            category: row.achievement_category,
          }
        : null,
  }));
}

export async function findPlayerStatsIdentity(
  groupId: string,
  groupPlayerId: string,
): Promise<PlayerStatsIdentity | null> {
  const result = await queryDatabase<PlayerIdentityRow>(
    `
      SELECT
        group_player.id AS group_player_id,
        player.display_name,
        player.profile_message,
        player.favorite_hand_card_1,
        player.favorite_hand_card_2,
        player.avatar_uploaded_at
      FROM group_players AS group_player
      INNER JOIN players AS player ON player.id = group_player.player_id
      WHERE group_player.group_id = $1 AND group_player.id = $2
    `,
    [groupId, groupPlayerId],
  );
  const row = result.rows[0];
  return row
    ? {
        groupPlayerId: row.group_player_id,
        displayName: row.display_name,
        profileMessage: row.profile_message,
        favoriteCard1: row.favorite_hand_card_1,
        favoriteCard2: row.favorite_hand_card_2,
        avatarUpdatedAt: row.avatar_uploaded_at?.toISOString() ?? null,
      }
    : null;
}

export async function listFinalizedPlayerGameStats(
  groupId: string,
  groupPlayerId: string,
): Promise<FinalizedPlayerGameStat[]> {
  const result = await queryDatabase<PlayerGameStatRow>(
    `
      SELECT
        game.id AS game_id,
        game.title AS game_title,
        game.played_at,
        game_result.rank,
        game_result.rebuy_count,
        game.initial_chips,
        CASE
          WHEN game.initial_chips > 0 THEN
            ((game_result.score - game.initial_chips)::NUMERIC * 100)
              / game.initial_chips
          ELSE NULL
        END AS net_bb
      FROM game_results AS game_result
      INNER JOIN games AS game ON game.id = game_result.game_id
      WHERE game.group_id = $1
        AND game_result.group_player_id = $2
        AND game.status = 'finalized'
      ORDER BY game.played_at ASC, game.finalized_at ASC, game.id ASC
    `,
    [groupId, groupPlayerId],
  );

  const invalidCount = result.rows.filter(
    (row) => Number(row.initial_chips) <= 0 || row.net_bb === null,
  ).length;
  assertValidInitialChips(invalidCount);

  return result.rows.map((row) => ({
    gameId: row.game_id,
    gameTitle: row.game_title,
    playedAt: row.played_at.toISOString(),
    rank: row.rank,
    rebuyCount: row.rebuy_count,
    netBb: Number(row.net_bb),
  }));
}

function assertValidInitialChips(invalidCount: number): void {
  if (invalidCount > 0) {
    throw new Error(
      "損益BBを算出できない確定済み開催があります（初期チップは1以上が必要です）",
    );
  }
}
