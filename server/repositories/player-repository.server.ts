import { queryDatabase } from "@server/db/client.server";
import type { GroupPlayerSummary } from "@shared-types/player";

interface GroupPlayerRow {
  id: string;
  display_name: string;
  is_active: boolean;
}

export async function listGroupPlayers(
  groupId: string,
): Promise<GroupPlayerSummary[]> {
  const result = await queryDatabase<GroupPlayerRow>(
    `
      SELECT
        group_player.id,
        COALESCE(group_player.display_name_override, player.display_name) AS display_name,
        group_player.is_active
      FROM group_players AS group_player
      INNER JOIN players AS player ON player.id = group_player.player_id
      WHERE group_player.group_id = $1
      ORDER BY group_player.is_active DESC, display_name ASC, group_player.created_at ASC
    `,
    [groupId],
  );

  return result.rows.map(mapGroupPlayer);
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

function mapGroupPlayer(row: GroupPlayerRow): GroupPlayerSummary {
  return {
    id: row.id,
    displayName: row.display_name,
    isActive: row.is_active,
  };
}
