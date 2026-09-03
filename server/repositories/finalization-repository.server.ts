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
  cost_shares: string[] | null;
  seven_deuce_rule_enabled: boolean;
  bomb_pot_rule_enabled: boolean;
}

interface ParticipantRow {
  group_player_id: string;
  display_name: string;
  remaining_chips: string | null;
  total_rebuy_count: number | null;
  outstanding_rebuy_count: number;
  settlement_rebuy_count: number | null;
}

interface ResultRow {
  group_player_id: string;
  display_name: string;
  remaining_chips: string;
  total_rebuy_count: number | null;
  tracked_outstanding_rebuy_count: number | null;
  settlement_rebuy_count: number;
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
             first_place_cost, second_place_cost, third_place_cost,
             cost_shares, seven_deuce_rule_enabled, bomb_pot_rule_enabled
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
             player.display_name AS display_name,
             participant.remaining_chips,
             participant.total_rebuy_count,
             participant.outstanding_rebuy_count,
             participant.settlement_rebuy_count
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
          game_id, group_player_id, remaining_chips, total_rebuy_count,
          tracked_outstanding_rebuy_count, settlement_rebuy_count, score, rank, cost_share
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        gameId,
        result.groupPlayerId,
        result.remainingChips,
        result.totalRebuyCount,
        result.trackedOutstandingRebuyCount,
        result.settlementRebuyCount,
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
          cost_shares = $8::BIGINT[],
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
      input.costShares,
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

export interface FinalizationReopenBlockers {
  hasResultRevisions: boolean;
  hasCostShareReceipts: boolean;
  hasStoryPosts: boolean;
}

export async function getFinalizationReopenBlockers(
  transaction: DatabaseTransaction,
  gameId: string,
): Promise<FinalizationReopenBlockers> {
  const result = await transaction.query<{
    has_result_revisions: boolean;
    has_cost_share_receipts: boolean;
    has_story_posts: boolean;
  }>(
    `
      SELECT
        EXISTS (
          SELECT 1
          FROM game_result_revisions
          WHERE game_id = $1
        ) AS has_result_revisions,
        EXISTS (
          SELECT 1
          FROM game_cost_share_receipts
          WHERE game_id = $1
        ) AS has_cost_share_receipts,
        EXISTS (
          SELECT 1
          FROM game_story_posts AS story
          INNER JOIN game_participants AS participant
            ON participant.id = story.game_participant_id
          WHERE participant.game_id = $1
        ) AS has_story_posts
    `,
    [gameId],
  );
  const row = result.rows[0];
  if (!row) throw new Error("failed to inspect finalization reopen blockers");
  return {
    hasResultRevisions: row.has_result_revisions,
    hasCostShareReceipts: row.has_cost_share_receipts,
    hasStoryPosts: row.has_story_posts,
  };
}

export async function deleteFinalResultsForReopen(
  transaction: DatabaseTransaction,
  gameId: string,
): Promise<void> {
  await transaction.query("DELETE FROM game_results WHERE game_id = $1", [gameId]);
}

export async function markGameOpenAfterFinalization(
  transaction: DatabaseTransaction,
  groupId: string,
  gameId: string,
): Promise<boolean> {
  const result = await transaction.query(
    `
      UPDATE games
      SET status = 'open', finalized_at = NULL, updated_at = NOW()
      WHERE id = $1 AND group_id = $2 AND status = 'finalized'
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
             player.display_name AS display_name,
             game_result.remaining_chips, game_result.total_rebuy_count,
             game_result.tracked_outstanding_rebuy_count,
             game_result.settlement_rebuy_count,
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
    totalRebuyCount: row.total_rebuy_count,
    trackedOutstandingRebuyCount: row.tracked_outstanding_rebuy_count,
    settlementRebuyCount: row.settlement_rebuy_count,
    score: Number(row.score),
    rank: row.rank,
    costShare: Number(row.cost_share),
  }));
}

export function toFinalizationParticipants(
  rows: ParticipantRow[],
): Array<FinalizationParticipant | null> {
  return rows.map((row) =>
    row.remaining_chips === null || row.settlement_rebuy_count === null
      ? null
      : {
          groupPlayerId: row.group_player_id,
          displayName: row.display_name,
          remainingChips: Number(row.remaining_chips),
          totalRebuyCount: row.total_rebuy_count,
          outstandingRebuyCount: row.outstanding_rebuy_count,
          settlementRebuyCount: row.settlement_rebuy_count,
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
    costShares: row.cost_shares?.map((value) => Number(value)) ?? null,
    sevenDeuceRuleEnabled: row.seven_deuce_rule_enabled,
    bombPotRuleEnabled: row.bomb_pot_rule_enabled,
  };
}

export async function lockFinalResults(
  transaction: DatabaseTransaction,
  gameId: string,
): Promise<GameResultSummary[]> {
  const result = await transaction.query<ResultRow>(
    `
      SELECT game_result.group_player_id,
             player.display_name AS display_name,
             game_result.remaining_chips, game_result.total_rebuy_count,
             game_result.tracked_outstanding_rebuy_count,
             game_result.settlement_rebuy_count,
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
            total_rebuy_count = $4,
            outstanding_rebuy_count = $5,
            settlement_rebuy_count = $6,
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
        participant.totalRebuyCount,
        participant.outstandingRebuyCount,
        participant.settlementRebuyCount,
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

export async function updateFinalizedGameIdentity(
  transaction: DatabaseTransaction,
  groupId: string,
  gameId: string,
  identity: { title: string; playedAt: string },
): Promise<boolean> {
  const result = await transaction.query(
    `
      UPDATE games
      SET title = $3,
          played_at = $4,
          updated_at = NOW()
      WHERE id = $1
        AND group_id = $2
        AND status = 'finalized'
    `,
    [gameId, groupId, identity.title, identity.playedAt],
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
    beforeResults: row.before_results.map(normalizeRevisionResult),
    afterResults: row.after_results.map(normalizeRevisionResult),
  }));
}

function normalizeRevisionResult(
  result: GameResultSummary,
): GameResultSummary {
  const legacy = result as GameResultSummary & { rebuyCount?: number };
  const settlementRebuyCount =
    result.settlementRebuyCount ?? legacy.rebuyCount ?? 0;
  return {
    ...result,
    totalRebuyCount: result.totalRebuyCount ?? null,
    trackedOutstandingRebuyCount:
      result.trackedOutstandingRebuyCount ?? null,
    settlementRebuyCount,
  };
}

function mapResultRow(row: ResultRow): GameResultSummary {
  return {
    groupPlayerId: row.group_player_id,
    displayName: row.display_name,
    remainingChips: Number(row.remaining_chips),
    totalRebuyCount: row.total_rebuy_count,
    trackedOutstandingRebuyCount: row.tracked_outstanding_rebuy_count,
    settlementRebuyCount: row.settlement_rebuy_count,
    score: Number(row.score),
    rank: row.rank,
    costShare: Number(row.cost_share),
  };
}
