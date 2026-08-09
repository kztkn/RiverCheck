import { queryDatabase } from "@server/db/client.server";

export async function saveGroupPayPayRecipientLinkRecord(
  groupId: string,
  link: string | null,
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
          updated_at = NOW()
      WHERE id = $1
    `,
    [groupId, link],
  );
  return result.rowCount === 1;
}

export async function findGamePaymentAmountForPlayer(
  groupId: string,
  gameId: string,
  playerId: string,
): Promise<number | null> {
  const result = await queryDatabase<{ cost_share: string }>(
    `
      SELECT game_result.cost_share
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
  return row ? Number(row.cost_share) : null;
}
