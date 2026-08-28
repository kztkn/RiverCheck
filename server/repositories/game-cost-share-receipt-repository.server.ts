import {
  queryDatabase,
  type DatabaseTransaction,
} from "@server/db/client.server";
import type { GameCostShareReceipt } from "@shared-types/result";

interface ReceiptRow {
  group_player_id: string;
  display_name: string;
  cost_share: string;
  received_at: Date | null;
}

export async function listGameCostShareReceipts(
  groupId: string,
  gameId: string,
): Promise<GameCostShareReceipt[]> {
  const result = await queryDatabase<ReceiptRow>(
    `
      SELECT game_result.group_player_id,
             player.display_name,
             game_result.cost_share,
             receipt.received_at
      FROM game_results AS game_result
      INNER JOIN games AS game ON game.id = game_result.game_id
      INNER JOIN group_players AS group_player
        ON group_player.id = game_result.group_player_id
      INNER JOIN players AS player ON player.id = group_player.player_id
      LEFT JOIN game_cost_share_receipts AS receipt
        ON receipt.game_id = game_result.game_id
       AND receipt.group_player_id = game_result.group_player_id
      WHERE game_result.game_id = $1
        AND game.group_id = $2
        AND game.status = 'finalized'
      ORDER BY game_result.rank ASC
    `,
    [gameId, groupId],
  );
  return result.rows.map((row) => ({
    groupPlayerId: row.group_player_id,
    displayName: row.display_name,
    costShare: Number(row.cost_share),
    receivedAt: row.received_at?.toISOString() ?? null,
  }));
}

export async function lockCostShareForReceipt(
  transaction: DatabaseTransaction,
  groupId: string,
  gameId: string,
  groupPlayerId: string,
): Promise<number | null> {
  const result = await transaction.query<{ cost_share: string }>(
    `
      SELECT game_result.cost_share
      FROM game_results AS game_result
      INNER JOIN games AS game ON game.id = game_result.game_id
      WHERE game_result.game_id = $1
        AND game_result.group_player_id = $2
        AND game.group_id = $3
        AND game.status = 'finalized'
      FOR UPDATE OF game_result
    `,
    [gameId, groupPlayerId, groupId],
  );
  const row = result.rows[0];
  return row ? Number(row.cost_share) : null;
}

export async function setGameCostShareReceived(
  transaction: DatabaseTransaction,
  gameId: string,
  groupPlayerId: string,
  received: boolean,
): Promise<void> {
  if (received) {
    await transaction.query(
      `
        INSERT INTO game_cost_share_receipts (game_id, group_player_id)
        VALUES ($1, $2)
        ON CONFLICT (game_id, group_player_id)
        DO UPDATE SET received_at = NOW()
      `,
      [gameId, groupPlayerId],
    );
    return;
  }

  await transaction.query(
    `
      DELETE FROM game_cost_share_receipts
      WHERE game_id = $1 AND group_player_id = $2
    `,
    [gameId, groupPlayerId],
  );
}

export async function clearChangedCostShareReceipts(
  transaction: DatabaseTransaction,
  gameId: string,
  groupPlayerIds: string[],
): Promise<void> {
  if (groupPlayerIds.length === 0) return;
  await transaction.query(
    `
      DELETE FROM game_cost_share_receipts
      WHERE game_id = $1 AND group_player_id = ANY($2::UUID[])
    `,
    [gameId, groupPlayerIds],
  );
}
