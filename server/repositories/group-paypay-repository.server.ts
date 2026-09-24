import { queryDatabase } from "@server/db/client.server";
import { calculateSettlementBalance } from "@domain/settlement/calculate-game-settlements";

export async function saveGroupPayPayRecipientLinkRecord(
  groupId: string,
  link: string | null,
  ownerPlayerId: string | null,
): Promise<boolean> {
  const result = await queryDatabase(
    `
      UPDATE groups
      SET paypay_link_registered_at = CASE
            WHEN $2::TEXT IS NULL THEN NULL
            WHEN paypay_recipient_link IS DISTINCT FROM $2::TEXT THEN NOW()
            ELSE paypay_link_registered_at
          END,
          paypay_recipient_link = $2,
          paypay_owner_player_id = CASE WHEN $2::TEXT IS NULL THEN NULL ELSE $3 END,
          updated_at = NOW()
      WHERE id = $1
    `,
    [groupId, link, ownerPlayerId],
  );
  return result.rowCount === 1;
}

export async function saveGamePayPayRecipientLinkRecord(
  groupId: string,
  gameId: string,
  link: string | null,
  ownerPlayerId: string | null,
): Promise<boolean> {
  const result = await queryDatabase(
    `
      UPDATE games
      SET paypay_link_registered_at = CASE
            WHEN $3::TEXT IS NULL THEN NULL
            WHEN paypay_recipient_link IS DISTINCT FROM $3::TEXT THEN NOW()
            ELSE paypay_link_registered_at
          END,
          paypay_recipient_link = $3,
          paypay_owner_player_id = CASE WHEN $3::TEXT IS NULL THEN NULL ELSE $4 END,
          updated_at = NOW()
      WHERE id = $1
        AND group_id = $2
    `,
    [gameId, groupId, link, ownerPlayerId],
  );
  return result.rowCount === 1;
}

export async function findGamePaymentAmountForPlayer(
  groupId: string,
  gameId: string,
  playerId: string,
): Promise<number | null> {
  const result = await queryDatabase<{
    cost_share: string;
    game_settlement_amount: string;
  }>(
    `
      SELECT game_result.cost_share, game_result.game_settlement_amount
      FROM game_results AS game_result
      INNER JOIN games AS game ON game.id = game_result.game_id
      INNER JOIN group_players AS group_player
        ON group_player.id = game_result.group_player_id
      WHERE game_result.game_id = $1
        AND game.group_id = $2
        AND group_player.player_id = $3
      LIMIT 1
    `,
    [gameId, groupId, playerId],
  );
  const row = result.rows[0];
  if (!row) return null;
  const settlementBalance = calculateSettlementBalance({
    costShare: Number(row.cost_share),
    gameSettlementAmount: Number(row.game_settlement_amount ?? 0),
  });
  return settlementBalance < 0 ? Math.abs(settlementBalance) : 0;
}
