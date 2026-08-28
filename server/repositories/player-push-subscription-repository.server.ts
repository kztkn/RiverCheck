import {
  queryDatabase,
  withTransaction,
} from "@server/db/client.server";

interface PushSubscriptionRow {
  player_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  updated_at: Date;
}

export interface PlayerPushSubscriptionRecord {
  playerId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  updatedAt: string;
}

export async function findPlayerPushSubscription(
  playerId: string,
): Promise<PlayerPushSubscriptionRecord | null> {
  const result = await queryDatabase<PushSubscriptionRow>(
    `
      SELECT player_id, endpoint, p256dh, auth, updated_at
      FROM player_push_subscriptions
      WHERE player_id = $1
    `,
    [playerId],
  );
  return result.rows[0] ? mapPushSubscription(result.rows[0]) : null;
}

export async function listGroupPlayerPushSubscriptions(
  groupId: string,
): Promise<PlayerPushSubscriptionRecord[]> {
  const result = await queryDatabase<PushSubscriptionRow>(
    `
      SELECT
        subscription.player_id,
        subscription.endpoint,
        subscription.p256dh,
        subscription.auth,
        subscription.updated_at
      FROM player_push_subscriptions AS subscription
      INNER JOIN group_players AS group_player
        ON group_player.player_id = subscription.player_id
      WHERE group_player.group_id = $1
        AND group_player.is_active = TRUE
      ORDER BY subscription.updated_at ASC
    `,
    [groupId],
  );
  return result.rows.map(mapPushSubscription);
}

export async function listGameParticipantPushSubscriptions(
  groupId: string,
  gameId: string,
): Promise<PlayerPushSubscriptionRecord[]> {
  const result = await queryDatabase<PushSubscriptionRow>(
    `
      SELECT
        subscription.player_id,
        subscription.endpoint,
        subscription.p256dh,
        subscription.auth,
        subscription.updated_at
      FROM game_participants AS participant
      INNER JOIN group_players AS group_player
        ON group_player.id = participant.group_player_id
      INNER JOIN player_push_subscriptions AS subscription
        ON subscription.player_id = group_player.player_id
      WHERE participant.game_id = $1
        AND group_player.group_id = $2
      ORDER BY participant.joined_at ASC
    `,
    [gameId, groupId],
  );
  return result.rows.map(mapPushSubscription);
}

export async function upsertPlayerPushSubscription(
  playerId: string,
  input: { endpoint: string; p256dh: string; auth: string },
): Promise<void> {
  await withTransaction(async (transaction) => {
    // A browser subscription belongs to the player currently selected on that
    // installation. Reassign it before the per-player upsert when the profile
    // was switched on the same device.
    await transaction.query(
      `
        DELETE FROM player_push_subscriptions
        WHERE endpoint = $2 AND player_id <> $1
      `,
      [playerId, input.endpoint],
    );
    await transaction.query(
      `
        INSERT INTO player_push_subscriptions (
          player_id,
          endpoint,
          p256dh,
          auth
        )
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (player_id) DO UPDATE
        SET endpoint = EXCLUDED.endpoint,
            p256dh = EXCLUDED.p256dh,
            auth = EXCLUDED.auth,
            updated_at = NOW()
      `,
      [playerId, input.endpoint, input.p256dh, input.auth],
    );
  });
}

export async function deletePlayerPushSubscription(
  playerId: string,
): Promise<void> {
  await queryDatabase(
    "DELETE FROM player_push_subscriptions WHERE player_id = $1",
    [playerId],
  );
}

export async function deletePlayerPushSubscriptionIfCurrent(
  playerId: string,
  endpoint: string,
): Promise<void> {
  await queryDatabase(
    `
      DELETE FROM player_push_subscriptions
      WHERE player_id = $1 AND endpoint = $2
    `,
    [playerId, endpoint],
  );
}

function mapPushSubscription(
  row: PushSubscriptionRow,
): PlayerPushSubscriptionRecord {
  return {
    playerId: row.player_id,
    endpoint: row.endpoint,
    p256dh: row.p256dh,
    auth: row.auth,
    updatedAt: row.updated_at.toISOString(),
  };
}
