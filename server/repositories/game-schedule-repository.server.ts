import { queryDatabase } from "@server/db/client.server";

export async function updateOpenGamePlayedAt(
  groupId: string,
  gameId: string,
  playedAt: string,
): Promise<boolean> {
  const result = await queryDatabase(
    `
      UPDATE games
      SET played_at = $3,
          updated_at = NOW()
      WHERE id = $1
        AND group_id = $2
        AND status = 'open'
    `,
    [gameId, groupId, playedAt],
  );
  return result.rowCount === 1;
}
