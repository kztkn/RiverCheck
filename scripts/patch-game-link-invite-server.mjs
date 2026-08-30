import { readFile, writeFile } from "node:fs/promises";

async function replaceOnce(path, before, after) {
  const source = await readFile(path, "utf8");
  if (!source.includes(before)) {
    throw new Error(`Expected text not found in ${path}: ${before.slice(0, 120)}`);
  }
  await writeFile(path, source.replace(before, after));
}

await replaceOnce(
  "server/repositories/player-profile-repository.server.ts",
  `interface ClaimRow {\n  id: string;\n  player_id: string;\n  group_player_id: string;\n  display_name: string;\n  expires_at: Date;\n}\n\nexport interface PlayerProfileRecord`,
  `interface ClaimRow {\n  id: string;\n  player_id: string;\n  group_player_id: string;\n  display_name: string;\n  expires_at: Date;\n}\n\ninterface PlayerSessionIdentityRow {\n  player_id: string;\n  display_name: string;\n}\n\nexport interface PlayerSessionIdentity {\n  playerId: string;\n  displayName: string;\n}\n\nexport interface PlayerProfileRecord`,
);

await replaceOnce(
  "server/repositories/player-profile-repository.server.ts",
  `export async function findPlayerProfileBySession(\n  groupId: string,\n  tokenHash: string,\n): Promise<PlayerProfileRecord | null> {`,
  `export async function findPlayerIdentityBySession(\n  tokenHash: string,\n): Promise<PlayerSessionIdentity | null> {\n  const result = await queryDatabase<PlayerSessionIdentityRow>(\n    \`\n      SELECT player.id AS player_id, player.display_name\n      FROM player_profile_sessions AS profile_session\n      INNER JOIN players AS player ON player.id = profile_session.player_id\n      WHERE profile_session.token_hash = $1\n        AND profile_session.revoked_at IS NULL\n        AND profile_session.expires_at > NOW()\n      LIMIT 1\n    \`,\n    [tokenHash],\n  );\n  const row = result.rows[0];\n  return row ? { playerId: row.player_id, displayName: row.display_name } : null;\n}\n\nexport async function findPlayerProfileBySession(\n  groupId: string,\n  tokenHash: string,\n): Promise<PlayerProfileRecord | null> {`,
);

await replaceOnce(
  "server/services/player-profile-service.server.ts",
  `  findPlayerAvatarRecord,\n  findPlayerProfileBySession,`,
  `  findPlayerAvatarRecord,\n  findPlayerIdentityBySession,\n  findPlayerProfileBySession,`,
);

await replaceOnce(
  "server/services/player-profile-service.server.ts",
  `export async function selectPlayerProfile(\n  publicCode: string,`,
  `export async function getAuthenticatedPlayerIdentity(request: Request) {\n  const token = readPlayerProfileToken(request);\n  return token ? findPlayerIdentityBySession(await hashToken(token)) : null;\n}\n\nexport async function selectPlayerProfile(\n  publicCode: string,`,
);

await replaceOnce(
  "server/repositories/participant-repository.server.ts",
  `import { queryDatabase } from "@server/db/client.server";`,
  `import { queryDatabase, withTransaction } from "@server/db/client.server";`,
);

await replaceOnce(
  "server/repositories/participant-repository.server.ts",
  `export async function updateParticipantInput(\n  groupId: string,`,
  `export async function joinExistingPlayerToGroupGame(\n  groupId: string,\n  gameId: string,\n  playerId: string,\n  tokenHash: string,\n): Promise<string | null> {\n  return withTransaction(async (transaction) => {\n    const game = await transaction.query<{ id: string }>(\n      \`\n        SELECT id\n        FROM games\n        WHERE id = $1\n          AND group_id = $2\n          AND status = 'open'\n        FOR UPDATE\n      \`,\n      [gameId, groupId],\n    );\n    if (!game.rows[0]) return null;\n\n    const membership = await transaction.query<{ id: string }>(\n      \`\n        WITH existing_membership AS (\n          SELECT id\n          FROM group_players\n          WHERE group_id = $1\n            AND player_id = $2\n            AND is_active = TRUE\n        ),\n        inserted_membership AS (\n          INSERT INTO group_players (group_id, player_id)\n          SELECT $1, player.id\n          FROM players AS player\n          WHERE player.id = $2\n            AND NOT EXISTS (\n              SELECT 1\n              FROM group_players AS existing\n              WHERE existing.group_id = $1\n                AND existing.player_id = $2\n            )\n          ON CONFLICT (group_id, player_id) DO NOTHING\n          RETURNING id\n        )\n        SELECT id FROM existing_membership\n        UNION ALL\n        SELECT id FROM inserted_membership\n        LIMIT 1\n      \`,\n      [groupId, playerId],\n    );\n    const groupPlayerId = membership.rows[0]?.id;\n    if (!groupPlayerId) return null;\n\n    await transaction.query(\n      \`\n        INSERT INTO game_participants (\n          game_id,\n          group_player_id,\n          participant_token_hash\n        )\n        VALUES ($1, $2, $3)\n        ON CONFLICT (game_id, group_player_id) DO NOTHING\n      \`,\n      [gameId, groupPlayerId, tokenHash],\n    );\n    return groupPlayerId;\n  });\n}\n\nexport async function updateParticipantInput(\n  groupId: string,`,
);

await replaceOnce(
  "server/services/participant-service.server.ts",
  `  findParticipantByGroupPlayerId,\n  joinAuthenticatedParticipant,`,
  `  findParticipantByGroupPlayerId,\n  joinAuthenticatedParticipant,\n  joinExistingPlayerToGroupGame,`,
);

await replaceOnce(
  "server/services/participant-service.server.ts",
  `import { getAuthenticatedPlayerProfile } from "./player-profile-service.server";`,
  `import {\n  getAuthenticatedPlayerIdentity,\n  getAuthenticatedPlayerProfile,\n} from "./player-profile-service.server";`,
);

const participantServicePath = "server/services/participant-service.server.ts";
const participantServiceSource = await readFile(participantServicePath, "utf8");
await writeFile(
  participantServicePath,
  participantServiceSource + `\nexport async function joinCurrentProfileToGroupGame(\n  request: Request,\n  input: { gameId: string; groupId: string },\n): Promise<\n  | { ok: true; displayName: string; groupPlayerId: string }\n  | { ok: false; error: string }\n> {\n  const identity = await getAuthenticatedPlayerIdentity(request);\n  if (!identity) {\n    return {\n      ok: false,\n      error: "保存済みの本人プロフィールを確認できません。画面を更新してください。",\n    };\n  }\n\n  const groupPlayerId = await joinExistingPlayerToGroupGame(\n    input.groupId,\n    input.gameId,\n    identity.playerId,\n    await hashToken(generateOpaqueToken()),\n  );\n  return groupPlayerId\n    ? {\n        ok: true,\n        displayName: identity.displayName,\n        groupPlayerId,\n      }\n    : {\n        ok: false,\n        error: "このプロフィールではグループに参加できません。主催者に確認してください。",\n      };\n}\n`,
);
