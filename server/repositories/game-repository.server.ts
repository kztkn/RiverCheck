import { queryDatabase } from "@server/db/client.server";
import type {
  CreateGameInput,
  GameDetails,
  GameListItem,
  GameStatus,
} from "@shared-types/game";

interface GameSummaryRow {
  id: string;
  title: string;
  played_at: Date;
  status: GameStatus;
  participant_count: number;
  winner_name: string | null;
}

interface GameDetailsRow {
  id: string;
  title: string;
  played_at: Date;
  status: GameStatus;
  group_id: string;
  initial_chips: string;
  rebuy_chips: string;
  preview_participant_count: number;
  venue_cost: string;
  first_place_cost: string;
  second_place_cost: string;
  third_place_cost: string;
  cost_shares: string[] | null;
}

interface FinalizedGamePublicRouteRow {
  id: string;
  public_code: string;
}

export async function listGamesForGroup(
  groupId: string,
): Promise<GameListItem[]> {
  const result = await queryDatabase<GameSummaryRow>(
    `
      SELECT
        game.id,
        game.title,
        game.played_at,
        game.status,
        COALESCE(participant_summary.participant_count, 0)::INTEGER
          AS participant_count,
        result_summary.winner_name
      FROM games AS game
      LEFT JOIN LATERAL (
        SELECT COUNT(participant.id)::INTEGER AS participant_count
        FROM game_participants AS participant
        WHERE participant.game_id = game.id
      ) AS participant_summary ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          MAX(
            CASE WHEN game_result.rank = 1
              THEN player.display_name
            END
          ) AS winner_name
        FROM game_results AS game_result
        INNER JOIN group_players AS group_player
          ON group_player.id = game_result.group_player_id
        INNER JOIN players AS player ON player.id = group_player.player_id
        WHERE game_result.game_id = game.id
      ) AS result_summary ON TRUE
      WHERE game.group_id = $1
      ORDER BY game.played_at DESC, game.created_at DESC
      LIMIT 50
    `,
    [groupId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    playedAt: row.played_at.toISOString(),
    status: row.status,
    participantCount: row.participant_count,
    winnerName: row.winner_name,
  }));
}

export async function findGameForGroup(
  groupId: string,
  gameId: string,
): Promise<GameDetails | null> {
  const result = await queryDatabase<GameDetailsRow>(
    `
      SELECT
        id,
        group_id,
        title,
        played_at,
        status,
        initial_chips,
        rebuy_chips,
        preview_participant_count,
        venue_cost,
        first_place_cost,
        second_place_cost,
        third_place_cost,
        cost_shares
      FROM games
      WHERE id = $1 AND group_id = $2
    `,
    [gameId, groupId],
  );
  const row = result.rows[0];
  if (!row) return null;

  return {
    id: row.id,
    groupId: row.group_id,
    title: row.title,
    playedAt: row.played_at.toISOString(),
    status: row.status,
    initialChips: Number(row.initial_chips),
    rebuyChips: Number(row.rebuy_chips),
    previewParticipantCount: row.preview_participant_count,
    venueCost: Number(row.venue_cost),
    firstPlaceCost: Number(row.first_place_cost),
    secondPlaceCost: Number(row.second_place_cost),
    thirdPlaceCost: Number(row.third_place_cost),
    costShares: mapCostShares(row.cost_shares),
  };
}

export async function findFinalizedGamePublicRoute(
  gameId: string,
): Promise<{ gameId: string; groupPublicCode: string } | null> {
  const result = await queryDatabase<FinalizedGamePublicRouteRow>(
    `
      SELECT game.id, game_group.public_code
      FROM games AS game
      INNER JOIN groups AS game_group ON game_group.id = game.group_id
      WHERE game.id = $1 AND game.status = 'finalized'
    `,
    [gameId],
  );
  const row = result.rows[0];
  return row
    ? { gameId: row.id, groupPublicCode: row.public_code }
    : null;
}

export async function insertGame(
  groupId: string,
  input: CreateGameInput,
): Promise<string> {
  const result = await queryDatabase<{ id: string }>(
    `
      INSERT INTO games (
        group_id,
        title,
        played_at,
        status,
        initial_chips,
        rebuy_chips,
        venue_cost,
        rounding_unit,
        first_place_cost,
        second_place_cost,
        third_place_cost,
        preview_participant_count,
        cost_shares
      )
      VALUES ($1, $2, $3, 'open', $4, $5, $6, 100, $7, $8, $9, $10, $11::BIGINT[])
      RETURNING id
    `,
    [
      groupId,
      input.title,
      input.playedAt,
      input.initialChips,
      input.rebuyChips,
      input.venueCost,
      input.firstPlaceCost,
      input.secondPlaceCost,
      input.thirdPlaceCost,
      input.previewParticipantCount,
      input.costShares,
    ],
  );

  const id = result.rows[0]?.id;
  if (!id) throw new Error("Game creation did not return an id");
  return id;
}

function mapCostShares(values: string[] | null): number[] | null {
  return values?.map((value) => Number(value)) ?? null;
}
