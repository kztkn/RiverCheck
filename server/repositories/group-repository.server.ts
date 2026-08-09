import type { GroupSummary } from "@shared-types/group";
import { queryDatabase } from "@server/db/client.server";

interface GroupRow {
  id: string;
  name: string;
  public_code: string;
  paypay_recipient_link: string | null;
  paypay_link_registered_at: Date | null;
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
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    publicCode: row.public_code,
    payPayRecipientLink: row.paypay_recipient_link,
    payPayLinkRegisteredAt:
      row.paypay_link_registered_at?.toISOString() ?? null,
  };
}
