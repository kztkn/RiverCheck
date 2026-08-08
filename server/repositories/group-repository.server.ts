import type { GroupSummary } from "@shared-types/group";
import { queryDatabase } from "@server/db/client.server";

interface GroupRow {
  id: string;
  name: string;
  public_code: string;
}

export async function findGroupByPublicCode(
  publicCode: string,
): Promise<GroupSummary | null> {
  const result = await queryDatabase<GroupRow>(
    `
      SELECT id, name, public_code
      FROM groups
      WHERE public_code = $1
    `,
    [publicCode],
  );
  const row = result.rows[0];
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    publicCode: row.public_code,
  };
}
