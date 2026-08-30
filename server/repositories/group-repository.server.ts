import {
  queryDatabase,
  withTransaction,
} from "@server/db/client.server";
import type {
  GroupDirectoryItem,
  GroupSummary,
} from "@shared-types/group";

interface GroupRow {
  id: string;
  name: string;
  public_code: string;
  paypay_recipient_link: string | null;
  paypay_link_registered_at: Date | null;
}

interface GroupDirectoryRow {
  id: string;
  name: string;
  public_code: string;
}

export async function findGroupByPublicCode(
  publicCode: string,
): Promise<GroupSummary | null> {
  const result = await queryDatabase<GroupRow>(
    `
      SELECT id, name, public_code,
             paypay_recipient_link, paypay_link_registered_at
      FROM groups
      WHERE public_code = $1
    `,
    [publicCode],
  );
  const row = result.rows[0];
  return row ? mapGroup(row) : null;
}

export async function listGroups(): Promise<GroupDirectoryItem[]> {
  const result = await queryDatabase<GroupDirectoryRow>(
    `
      SELECT id, name, public_code
      FROM groups
      ORDER BY created_at ASC, name ASC
    `,
  );
  return result.rows.map(mapDirectoryItem);
}

export async function listGroupsForPlayer(
  playerId: string,
): Promise<GroupDirectoryItem[]> {
  const result = await queryDatabase<GroupDirectoryRow>(
    `
      SELECT group_record.id, group_record.name, group_record.public_code
      FROM group_players AS group_player
      INNER JOIN groups AS group_record ON group_record.id = group_player.group_id
      WHERE group_player.player_id = $1
        AND group_player.is_active = TRUE
      ORDER BY group_player.created_at ASC, group_record.name ASC
    `,
    [playerId],
  );
  return result.rows.map(mapDirectoryItem);
}

export async function insertGroup(
  name: string,
  publicCode: string,
  initialPlayerId: string | null,
): Promise<GroupSummary> {
  return withTransaction(async (transaction) => {
    const inserted = await transaction.query<GroupRow>(
      `
        INSERT INTO groups (name, public_code)
        VALUES ($1, $2)
        RETURNING id, name, public_code,
                  paypay_recipient_link, paypay_link_registered_at
      `,
      [name, publicCode],
    );
    const row = inserted.rows[0];
    if (!row) throw new Error("Group creation did not return a row");

    if (initialPlayerId) {
      await transaction.query(
        `
          INSERT INTO group_players (group_id, player_id)
          SELECT $1, player.id
          FROM players AS player
          WHERE player.id = $2
          ON CONFLICT (group_id, player_id) DO NOTHING
        `,
        [row.id, initialPlayerId],
      );
    }

    return mapGroup(row);
  });
}

export async function updateGroupName(
  groupId: string,
  name: string,
): Promise<boolean> {
  const result = await queryDatabase(
    `
      UPDATE groups
      SET name = $2
      WHERE id = $1
    `,
    [groupId, name],
  );
  return result.rowCount === 1;
}

function mapGroup(row: GroupRow): GroupSummary {
  return {
    id: row.id,
    name: row.name,
    publicCode: row.public_code,
    payPayRecipientLink: row.paypay_recipient_link,
    payPayLinkRegisteredAt:
      row.paypay_link_registered_at?.toISOString() ?? null,
  };
}

function mapDirectoryItem(row: GroupDirectoryRow): GroupDirectoryItem {
  return {
    id: row.id,
    name: row.name,
    publicCode: row.public_code,
  };
}
