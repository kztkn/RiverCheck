import {
  queryDatabase,
  type DatabaseTransaction,
} from "@server/db/client.server";
import type {
  CreateGameInput,
  GameDetails,
  GameStatus,
} from "@shared-types/game";
import type {
  GameResultRevision,
  GameResultSummary,
} from "@shared-types/result";
import type { FinalizationParticipant } from "@domain/finalization/calculate-final-results";

interface GameRow {
  id: string;
  group_id: string;
  title: string;
  played_at: Date;
  status: GameStatus;
  initial_chips: string;
  rebuy_chips: string;
  preview_participant_count: number;
  venue_cost: string;
  first_place_cost: string;
  second_place_cost: string;
  third_place_cost: string;
}

interface ParticipantRow {
  group_player_id: string;
  display_name: string;
  remaining_chips: string | null;
  rebuy_count: number;
}

interface ResultRow {
  group_player_id: string;
  display_name: string;
  remaining_chips: string;
  rebuy_count: number;
  score: string;
  rank: number;
  cost_share: string;
}

interface RevisionRow {
  id: string;
  revision_number: number;
  corrected_at: Date;
  before_results: GameResultSummary[];
  after_results: GameResultSummary[];
}

export async function lockGameForFinalization(
  transaction: DatabaseTransaction,
  groupId: string,
  gameId: string,
): Promise<GameDetails | null> {
  const result = await transaction.query<GameRow>(
    `
      SELECT id, group_id, title, played_at, status, initial_chips,
             rebuy_chips, preview_participant_count, venue_cost,
             first_place_cost, second_place_cost, third_place_cost
      FROM games
      WHERE id = $1 AND group_id = $2
      FOR UPDATE
    `,
    [gameId, groupId],
  );
  const row = result.rows[0];
  return row ? mapGame(row) : null;
}

export async function lockParticipantsForFinalization(
  transaction: DatabaseTransaction,
  gameId: string,
): Promise<ParticipantRow[]> {
  const result = await transaction.query<ParticipantRow>(
    `
      SELECT participant.group_player_id,
             COALESCE(group_player.display_name_override, player.display_name) AS display_name,
             participant.remaining_chips,
             participant.rebuy_count
      FROM game_participants AS participant
      INNER JOIN group_players AS group_player
        ON group_player.id = participant.group_player_id
      INNER JOIN players AS player ON player.id = group_player.player_id
      WHERE participant.game_id = $1
      ORDER BY participant.joined_at ASC
      FOR UPDATE OF participant
    `,
    [gameId],
  );
  return result.rows;
}

export async function insertFinalResults(
  transaction: DatabaseTransaction,
  gameId: string,
  results: GameResultSummary[],
): Promise<void> {
  for (const result of results) {
    await transaction.query(
      `
        INSERT INTO game_results (
          game_id, group_player_id, remaining_chips, rebuy_count,
          score, rank, cost_share
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        gameId,
        result.groupPlayerId,
        result.remainingChips,
        result.rebuyCount,
        result.score,
        result.rank,
        result.costShare,
      ],
    );
  }
}

export async function saveCostSettingsForFinalization(
  transaction: DatabaseTransaction,
  groupId: string,
  gameId: string,
  input: CreateGameInput,
): Promise<boolean> {
  const result = await transaction.query(
    `
      UPDATE games
      SET venue_cost = $3,
          rounding_unit = 100,
          first_place_cost = $4,
          second_place_cost = $5,
          third_place_cost = $6,
          preview_participant_count = $7,
          updated_at = NOW()
      WHERE id = $1 AND group_id = $2 AND status = 'open'
    `,
    [
      gameId,
      groupId,
      input.venueCost,
      input.firstPlaceCost,
      input.secondPlaceCost,
      input.thirdPlaceCost,
      input.previewParticipantCount,
    ],
  );
  return result.rowCount === 1;
}

export async function markGameFinalized(
  transaction: DatabaseTransaction,
  groupId: string,
  gameId: string,
): Promise<boolean> {
  const result = await transaction.query(
    `
      UPDATE games
      SET status = 'finalized', finalized_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND group_id = $2 AND status = 'open'
    `,
    [gameId, groupId],
  );
  return result.rowCount === 1;
}

export async function listFinalResults(
  groupId: string,
  gameId: string,
): Promise<GameResultSummary[]> {
  const result = await queryDatabase<ResultRow>(
    `
      SELECT game_result.group_player_id,
             COALESCE(group_player.display_name_override, player.display_name) AS display_name,
             game_result.remaining_chips, game_result.rebuy_count,
             game_result.score, game_result.rank, game_result.cost_share
      FROM game_results AS game_result
      INNER JOIN games AS game ON game.id = game_result.game_id
      INNER JOIN group_players AS group_player
        ON group_player.id = game_result.group_player_id
      INNER JOIN players AS player ON player.id = group_player.player_id
      WHERE game_result.game_id = $1 AND game.group_id = $2
      ORDER BY game_result.rank ASC
    `,
    [gameId, groupId],
  );
  return result.rows.map((row) => ({
    groupPlayerId: row.group_player_id,
    displayName: row.display_name,
    remainingChips: Number(row.remaining_chips),
    rebuyCount: row.rebuy_count,
    score: Number(row.score),
    rank: row.rank,
    costShare: Number(row.cost_share),
  }));
}

export function toFinalizationParticipants(
  rows: ParticipantRow[],
): Array<FinalizationParticipant | null> {
  return rows.map((row) =>
    row.remaining_chips === null
      ? null
      : {
          groupPlayerId: row.group_player_id,
          displayName: row.display_name,
          remainingChips: Number(row.remaining_chips),
          rebuyCount: row.rebuy_count,
        },
  );
}

function mapGame(row: GameRow): GameDetails {
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

export async function lockFinalResults(
  transaction: DatabaseTransaction,
  gameId: string,
): Promise<GameResultSummary[]> {
  const result = await transaction.query<ResultRow>(
    `
      SELECT game_result.group_player_id,
             COALESCE(group_player.display_name_override, player.display_name) AS display_name,
             game_result.remaining_chips, game_result.rebuy_count,
             game_result.score, game_result.rank, game_result.cost_share
      FROM game_results AS game_result
      INNER JOIN group_players AS group_player
        ON group_player.id = game_result.group_player_id
      INNER JOIN players AS player ON player.id = group_player.player_id
      WHERE game_result.game_id = $1
      ORDER BY game_result.rank ASC
      FOR UPDATE OF game_result
    `,
    [gameId],
  );
  return result.rows.map(mapResultRow);
}

export async function updateParticipantsForCorrection(
  transaction: DatabaseTransaction,
  gameId: string,
  participants: FinalizationParticipant[],
): Promise<void> {
  for (const participant of participants) {
    const result = await transaction.query(
      `
        UPDATE game_participants AS participant
        SET remaining_chips = $3,
            rebuy_count = $4,
            status = 'submitted',
            updated_at = NOW()
        FROM games AS game
        WHERE participant.game_id = $1
          AND participant.group_player_id = $2
          AND game.id = participant.game_id
          AND game.status = 'finalized'
      `,
      [
        gameId,
        participant.groupPlayerId,
        participant.remainingChips,
        participant.rebuyCount,
      ],
    );
    if (result.rowCount !== 1) {
      throw new Error("participant changed during result correction");
    }
  }
}

export async function replaceFinalResults(
  transaction: DatabaseTransaction,
  gameId: string,
  results: GameResultSummary[],
): Promise<void> {
  await transaction.query("DELETE FROM game_results WHERE game_id = $1", [
    gameId,
  ]);
  await insertFinalResults(transaction, gameId, results);
}

export async function insertResultRevision(
  transaction: DatabaseTransaction,
  gameId: string,
  beforeResults: GameResultSummary[],
  afterResults: GameResultSummary[],
): Promise<void> {
  await transaction.query(
    `
      INSERT INTO game_result_revisions (
        game_id, revision_number, before_results, after_results
      )
      SELECT $1,
             COALESCE(MAX(revision_number), 0) + 1,
             $2::jsonb,
             $3::jsonb
      FROM game_result_revisions
      WHERE game_id = $1
    `,
    [gameId, JSON.stringify(beforeResults), JSON.stringify(afterResults)],
  );
}

export async function touchGameAfterCorrection(
  transaction: DatabaseTransaction,
  groupId: string,
  gameId: string,
): Promise<boolean> {
  const result = await transaction.query(
    `
      UPDATE games
      SET updated_at = NOW()
      WHERE id = $1 AND group_id = $2 AND status = 'finalized'
    `,
    [gameId, groupId],
  );
  return result.rowCount === 1;
}

export async function listResultRevisions(
  groupId: string,
  gameId: string,
): Promise<GameResultRevision[]> {
  const result = await queryDatabase<RevisionRow>(
    `
      SELECT revision.id,
             revision.revision_number,
             revision.corrected_at,
             revision.before_results,
             revision.after_results
      FROM game_result_revisions AS revision
      INNER JOIN games AS game ON game.id = revision.game_id
      WHERE revision.game_id = $1 AND game.group_id = $2
      ORDER BY revision.revision_number DESC
    `,
    [gameId, groupId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    revisionNumber: row.revision_number,
    correctedAt: row.corrected_at.toISOString(),
    beforeResults: row.before_results,
    afterResults: row.after_results,
  }));
}

function mapResultRow(row: ResultRow): GameResultSummary {
  return {
    groupPlayerId: row.group_player_id,
    displayName: row.display_name,
    remainingChips: Number(row.remaining_chips),
    rebuyCount: row.rebuy_count,
    score: Number(row.score),
    rank: row.rank,
    costShare: Number(row.cost_share),
  };
}
