import { queryDatabase } from "@server/db/client.server";

export async function hasGroupEventCreatorPermission(
  groupId: string,
  playerId: string,
): Promise<boolean> {
  const result = await queryDatabase<{ allowed: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM group_event_creator_permissions AS permission
        INNER JOIN group_players AS membership
          ON membership.group_id = permission.group_id
         AND membership.player_id = permission.player_id
         AND membership.is_active = TRUE
        WHERE permission.group_id = $1
          AND permission.player_id = $2
      ) AS allowed
    `,
    [groupId, playerId],
  );
  return result.rows[0]?.allowed ?? false;
}

export async function setGroupEventCreatorPermission(
  groupId: string,
  groupPlayerId: string,
  allowed: boolean,
): Promise<boolean> {
  if (allowed) {
    const result = await queryDatabase(
        `
          INSERT INTO group_event_creator_permissions (group_id, player_id)
          SELECT membership.group_id, membership.player_id
          FROM group_players AS membership
          WHERE membership.group_id = $1
            AND membership.id = $2
            AND membership.is_active = TRUE
          ON CONFLICT (group_id, player_id) DO UPDATE
          SET granted_at = group_event_creator_permissions.granted_at
          RETURNING player_id
        `,
        [groupId, groupPlayerId],
      );
    return result.rowCount === 1;
  }

  const result = await queryDatabase<{ valid_target: boolean }>(
        `
          WITH target AS (
            SELECT group_id, player_id
            FROM group_players
            WHERE group_id = $1
              AND id = $2
              AND is_active = TRUE
          ),
          deleted AS (
            DELETE FROM group_event_creator_permissions AS permission
            USING target
            WHERE permission.group_id = target.group_id
              AND permission.player_id = target.player_id
          )
          SELECT EXISTS (SELECT 1 FROM target) AS valid_target
        `,
        [groupId, groupPlayerId],
      );
  return result.rows[0]?.valid_target ?? false;
}
