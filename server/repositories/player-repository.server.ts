import { queryDatabase } from "@server/db/client.server";
import type {
  GroupPlayerSummary,
  ReusablePlayerSummary,
} from "@shared-types/player";

interface GroupPlayerRow {
  id: string;
  display_name: string;
  is_active: boolean;
  profile_message: string | null;
  avatar_uploaded_at: Date | null;
  has_profile_access: boolean;
}

interface ReusablePlayerRow {
  player_id: string;
  display_name: string;
  avatar_uploaded_at: Date | null;
  has_profile_access: boolean;
  group_names: string[];
  source_group_code: string | null;
  source_group_player_id: string | null;
}

export async function listGroupPlayers(
  groupId: string,
): Promise<GroupPlayerSummary[]> {
  const result = await queryDatabase<GroupPlayerRow>(
    `
      SELECT
        group_player.id,
        player.display_name,
        group_player.is_active,
        player.profile_message,
        player.avatar_uploaded_at,
        EXISTS (
          SELECT 1
          FROM player_profile_sessions AS profile_session
          WHERE profile_session.player_id = player.id
            AND profile_session.revoked_at IS NULL
            AND profile_session.expires_at > NOW()
        ) AS has_profile_access
      FROM group_players AS group_player
      INNER JOIN players AS player ON player.id = group_player.player_id
      WHERE group_player.group_id = $1
      ORDER BY group_player.is_active DESC, display_name ASC, group_player.created_at ASC
    `,
    [groupId],
  );

  return result.rows.map(mapGroupPlayer);
}

export async function listReusablePlayersForGroup(
  groupId: string,
): Promise<ReusablePlayerSummary[]> {
  const result = await queryDatabase<ReusablePlayerRow>(
    `
      SELECT
        player.id AS player_id,
        player.display_name,
        player.avatar_uploaded_at,
        EXISTS (
          SELECT 1
          FROM player_profile_sessions AS profile_session
          WHERE profile_session.player_id = player.id
            AND profile_session.revoked_at IS NULL
            AND profile_session.expires_at > NOW()
        ) AS has_profile_access,
        ARRAY(
          SELECT source_group.name
          FROM group_players AS source_membership
          INNER JOIN groups AS source_group
            ON source_group.id = source_membership.group_id
          WHERE source_membership.player_id = player.id
            AND source_membership.is_active = TRUE
          ORDER BY source_membership.created_at ASC, source_group.name ASC
        ) AS group_names,
        (
          SELECT source_group.public_code
          FROM group_players AS source_membership
          INNER JOIN groups AS source_group
            ON source_group.id = source_membership.group_id
          WHERE source_membership.player_id = player.id
            AND source_membership.is_active = TRUE
          ORDER BY source_membership.created_at ASC
          LIMIT 1
        ) AS source_group_code,
        (
          SELECT source_membership.id
          FROM group_players AS source_membership
          WHERE source_membership.player_id = player.id
            AND source_membership.is_active = TRUE
          ORDER BY source_membership.created_at ASC
          LIMIT 1
        ) AS source_group_player_id
      FROM players AS player
      WHERE EXISTS (
        SELECT 1
        FROM group_players AS source_membership
        WHERE source_membership.player_id = player.id
          AND source_membership.is_active = TRUE
      )
        AND NOT EXISTS (
          SELECT 1
          FROM group_players AS target_membership
          WHERE target_membership.group_id = $1
            AND target_membership.player_id = player.id
        )
      ORDER BY has_profile_access DESC, player.display_name ASC, player.created_at ASC
    `,
    [groupId],
  );

  return result.rows.map((row) => ({
    playerId: row.player_id,
    displayName: row.display_name,
    avatarUpdatedAt: row.avatar_uploaded_at?.toISOString() ?? null,
    hasProfileAccess: row.has_profile_access,
    groupNames: row.group_names,
    sourceGroupCode: row.source_group_code,
    sourceGroupPlayerId: row.source_group_player_id,
  }));
}

export async function attachExistingPlayerToGroup(
  groupId: string,
  playerId: string,
): Promise<string | null> {
  const result = await queryDatabase<{ id: string }>(
    `
      INSERT INTO group_players (group_id, player_id)
      SELECT $1, player.id
      FROM players AS player
      WHERE player.id = $2
      ON CONFLICT (group_id, player_id) DO NOTHING
      RETURNING id
    `,
    [groupId, playerId],
  );
  return result.rows[0]?.id ?? null;
}

export async function insertPlayerForGroup(
  groupId: string,
  displayName: string,
): Promise<string> {
  const result = await queryDatabase<{ id: string }>(
    `
      WITH new_player AS (
        INSERT INTO players (display_name)
        VALUES ($2)
        RETURNING id
      )
      INSERT INTO group_players (group_id, player_id)
      SELECT $1, new_player.id
      FROM new_player
      RETURNING id
    `,
    [groupId, displayName],
  );

  const id = result.rows[0]?.id;
  if (!id) throw new Error("Player creation did not return an id");
  return id;
}

export async function updatePlayerDisplayNameForGroup(
  groupId: string,
  groupPlayerId: string,
  displayName: string,
): Promise<boolean> {
  const result = await queryDatabase(
    `
      UPDATE players AS player
      SET display_name = $3,
          updated_at = NOW()
      FROM group_players AS group_player
      WHERE group_player.group_id = $1
        AND group_player.id = $2
        AND group_player.player_id = player.id
      RETURNING player.id
    `,
    [groupId, groupPlayerId, displayName],
  );
  return result.rowCount === 1;
}

function mapGroupPlayer(row: GroupPlayerRow): GroupPlayerSummary {
  return {
    id: row.id,
    displayName: row.display_name,
    isActive: row.is_active,
    profileMessage: row.profile_message,
    avatarUpdatedAt: row.avatar_uploaded_at?.toISOString() ?? null,
    hasProfileAccess: row.has_profile_access,
  };
}
