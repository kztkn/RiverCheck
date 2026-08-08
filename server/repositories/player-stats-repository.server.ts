import { queryDatabase } from "@server/db/client.server";
import type {
  PlayerStatsRankingRow,
  PlayerStatsSort,
} from "@shared-types/player-stats";

interface RankingRow {
  leaderboard_rank: string;
  group_player_id: string;
  display_name: string;
  games_played: number;
  wins: number;
  total_net_bb: string;
  average_net_bb: string;
  invalid_initial_chips_count: number;
}

interface PlayerIdentityRow {
  group_player_id: string;
  display_name: string;
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
  const orderExpression =
    sort === "average"
      ? "average_net_bb DESC, total_net_bb DESC"
      : "total_net_bb DESC, average_net_bb DESC";

  const result = await queryDatabase<RankingRow>(
    `
      WITH finalized_results AS (
        SELECT
          game_result.game_id,
          game_result.group_player_id,
          game_result.rank,
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
          AND game.status = 'finalized'
      ),
      player_aggregates AS (
        SELECT
          group_player.id AS group_player_id,
          COALESCE(group_player.display_name_override, player.display_name)
            AS display_name,
          COUNT(finalized_result.game_id)::INTEGER AS games_played,
          COUNT(finalized_result.game_id)
            FILTER (WHERE finalized_result.rank = 1)::INTEGER AS wins,
          COALESCE(SUM(finalized_result.net_bb), 0) AS total_net_bb,
          COALESCE(AVG(finalized_result.net_bb), 0) AS average_net_bb,
          COUNT(finalized_result.game_id)
            FILTER (WHERE finalized_result.initial_chips <= 0)::INTEGER
            AS invalid_initial_chips_count
        FROM group_players AS group_player
        INNER JOIN players AS player ON player.id = group_player.player_id
        LEFT JOIN finalized_results AS finalized_result
          ON finalized_result.group_player_id = group_player.id
        WHERE group_player.group_id = $1
        GROUP BY group_player.id, display_name
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
        total_net_bb,
        average_net_bb,
        invalid_initial_chips_count
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
    totalNetBb: Number(row.total_net_bb),
    averageNetBb: Number(row.average_net_bb),
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
        COALESCE(group_player.display_name_override, player.display_name)
          AS display_name
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
