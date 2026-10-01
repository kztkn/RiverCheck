import { queryDatabase, withTransaction } from "@server/db/client.server";
import { validateTableAllocation } from "@domain/table-management/table-management";
import type { TableMove, TablePosition, TableSeat } from "@shared-types/table-management";

export async function readTableManagement(groupId: string, gameId: string) {
  // A single snapshot keeps seats, history and the server clock consistent.
  const result = await queryDatabase<{
    started_at: Date | null;
    server_now: Date;
    participants: TableSeat[];
    moves: TableMove[];
  }>(`
    SELECT game.table_management_started_at AS started_at, clock_timestamp() AS server_now,
      COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'groupPlayerId', participant.group_player_id, 'displayName', player.display_name,
        'table', participant.table_position, 'subEnteredAt', participant.sub_entered_at
      ) ORDER BY participant.created_at, participant.id)
        FROM game_participants participant
        JOIN group_players membership ON membership.id = participant.group_player_id
        JOIN players player ON player.id = membership.player_id
        WHERE participant.game_id = game.id), '[]'::jsonb) AS participants,
      COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', move.id, 'displayName', player.display_name, 'fromTable', move.from_table,
        'toTable', move.to_table, 'recordedAt', move.recorded_at
      ) ORDER BY move.recorded_at DESC, move.id DESC)
        FROM game_table_moves move
        JOIN group_players membership ON membership.id = move.group_player_id
        JOIN players player ON player.id = membership.player_id
        WHERE move.game_id = game.id), '[]'::jsonb) AS moves
    FROM games game WHERE game.id = $1 AND game.group_id = $2
  `, [gameId, groupId]);
  const row = result.rows[0];
  if (!row) return null;
  return {
    startedAt: row.started_at?.toISOString() ?? null,
    serverNow: row.server_now.toISOString(),
    participants: row.participants,
    moves: row.moves,
  };
}

export async function startTableManagement(input: {
  groupId: string; gameId: string; mainIds: string[]; subIds: string[];
}): Promise<boolean> {
  return withTransaction(async (transaction) => {
    const game = await transaction.query<{ id: string }>(`
      SELECT id FROM games WHERE id = $1 AND group_id = $2 AND status = 'open'
        AND table_management_started_at IS NULL FOR UPDATE
    `, [input.gameId, input.groupId]);
    if (!game.rows[0]) return false;
    const participants = await transaction.query<{ group_player_id: string }>(`
      SELECT group_player_id FROM game_participants WHERE game_id = $1 FOR UPDATE
    `, [input.gameId]);
    if (!validateTableAllocation(participants.rows.map((row) => row.group_player_id), input.mainIds, input.subIds)) return false;
    const started = await transaction.query<{ started_at: Date }>(`
      UPDATE games SET table_management_started_at = clock_timestamp()
      WHERE id = $1 RETURNING table_management_started_at AS started_at
    `, [input.gameId]);
    await transaction.query(`
      UPDATE game_participants
      SET table_position = CASE WHEN group_player_id = ANY($2::uuid[]) THEN 'SUB' ELSE 'MAIN' END,
          sub_entered_at = CASE WHEN group_player_id = ANY($2::uuid[]) THEN $3::timestamptz ELSE NULL END
      WHERE game_id = $1
    `, [input.gameId, input.subIds, started.rows[0]!.started_at]);
    return true;
  });
}

export async function moveTableParticipant(input: {
  groupId: string; gameId: string; groupPlayerId: string; commandId: string;
  fromTable: TablePosition; toTable: TablePosition; expectedSubEnteredAt: string | null;
  actorPlayerId: string | null;
}): Promise<boolean> {
  return withTransaction(async (transaction) => {
    // Serializes manager actions with start/finalize/registration on this game.
    const game = await transaction.query<{ id: string }>(`
      SELECT id FROM games WHERE id = $1 AND group_id = $2 AND status = 'open'
        AND table_management_started_at IS NOT NULL FOR UPDATE
    `, [input.gameId, input.groupId]);
    if (!game.rows[0] || input.fromTable === input.toTable) return false;
    const replay = await transaction.query<{ same_command: boolean }>(`
      SELECT (game_id = $2 AND group_player_id = $3 AND from_table = $4 AND to_table = $5) AS same_command
      FROM game_table_moves WHERE command_id = $1
    `, [input.commandId, input.gameId, input.groupPlayerId, input.fromTable, input.toTable]);
    if (replay.rows[0]) return replay.rows[0].same_command;
    const updated = await transaction.query<{ moved_at: Date }>(`
      UPDATE game_participants SET table_position = $4,
        sub_entered_at = CASE WHEN $4 = 'SUB' THEN clock_timestamp() ELSE NULL END
      WHERE game_id = $1 AND group_player_id = $2 AND table_position = $3
        AND sub_entered_at IS NOT DISTINCT FROM $5::timestamptz
      RETURNING COALESCE(sub_entered_at, clock_timestamp()) AS moved_at
    `, [input.gameId, input.groupPlayerId, input.fromTable, input.toTable, input.expectedSubEnteredAt]);
    if (!updated.rows[0]) return false;
    await transaction.query(`
      INSERT INTO game_table_moves (command_id, game_id, group_player_id, from_table, to_table, recorded_at, recorded_by_player_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [input.commandId, input.gameId, input.groupPlayerId, input.fromTable, input.toTable, updated.rows[0].moved_at, input.actorPlayerId]);
    return true;
  });
}
