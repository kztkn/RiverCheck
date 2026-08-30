import { queryDatabase } from "@server/db/client.server";

export async function saveGroupLineOpenChatUrlRecord(
  groupId: string,
  lineOpenChatUrl: string | null,
): Promise<boolean> {
  const result = await queryDatabase(
    `
      UPDATE groups
      SET line_open_chat_url = $2
      WHERE id = $1
    `,
    [groupId, lineOpenChatUrl],
  );
  return result.rowCount === 1;
}
