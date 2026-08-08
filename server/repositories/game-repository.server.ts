import { queryDatabase } from "@server/db/client.server";
import type {
  CreateGameInput,
  GameDetails,
  GameStatus,
  GameSummary,
} from "@shared-types/game";

interface GameSummaryRow {
  id: string;
  title: string;
  played_at: Date;
  status: GameStatus;
}

interface GameDetailsRow extends GameSummaryRow {
  group_id: string;
  initial_chips: string;
  rebuy_chips: string;
  preview_participant_count: number;
  venue_cost: string;
  first_place_cost: string;
  second_place_cost: string;
  third_place_cost: string;
}

export async function listGamesForGroup(
  groupId: string,
): Promise<GameSummary[]> {
  const result = await queryDatabase<GameSummaryRow>(
    `
      SELECT id, title, played_at, status
      FROM games
      WHERE group_id = $1
      ORDER BY played_at DESC, created_at DESC
      LIMIT 50
    `,
    [groupId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    playedAt: row.played_at.toISOString(),
    status: row.status,
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
        third_place_cost
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
  };
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
        preview_participant_count
      )
      VALUES ($1, $2, $3, 'open', $4, $5, $6, 100, $7, $8, $9, $10)
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
    ],
  );

  const id = result.rows[0]?.id;
  if (!id) throw new Error("Game creation did not return an id");
  return id;
}
