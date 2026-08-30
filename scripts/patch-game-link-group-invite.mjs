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

await replaceOnce(
  "server/services/participant-service.server.ts",
  `}\n`,
  `}\n\nexport async function joinCurrentProfileToGroupGame(\n  request: Request,\n  input: { gameId: string; groupId: string },\n): Promise<\n  | { ok: true; displayName: string; groupPlayerId: string }\n  | { ok: false; error: string }\n> {\n  const identity = await getAuthenticatedPlayerIdentity(request);\n  if (!identity) {\n    return {\n      ok: false,\n      error: "保存済みの本人プロフィールを確認できません。画面を更新してください。",\n    };\n  }\n\n  const groupPlayerId = await joinExistingPlayerToGroupGame(\n    input.groupId,\n    input.gameId,\n    identity.playerId,\n    await hashToken(generateOpaqueToken()),\n  );\n  return groupPlayerId\n    ? {\n        ok: true,\n        displayName: identity.displayName,\n        groupPlayerId,\n      }\n    : {\n        ok: false,\n        error: "このプロフィールではグループに参加できません。主催者に確認してください。",\n      };\n}\n`,
);

await writeFile(
  "app/components/group-invite-join-panel.tsx",
  `import { Form } from "react-router";\n\nexport function GroupInviteJoinPanel({\n  displayName,\n  groupName,\n  isSubmitting,\n}: {\n  displayName: string;\n  groupName: string;\n  isSubmitting: boolean;\n}) {\n  return (\n    <section className="participant-panel">\n      <div className="section-heading compact-heading">\n        <div>\n          <p className="eyebrow">GROUP INVITE</p>\n          <h2>{groupName}に参加</h2>\n        </div>\n      </div>\n      <p className="muted-copy">\n        RiverCheckで「{displayName}」として利用中です。このプロフィールのままグループへ参加し、今回の開催にも登録できます。\n      </p>\n      <Form method="post" reloadDocument>\n        <input\n          name="intent"\n          type="hidden"\n          value="join-current-profile-to-group"\n        />\n        <button\n          className="button button-primary"\n          disabled={isSubmitting}\n          type="submit"\n        >\n          {isSubmitting ? "参加中…" : `${displayName}として参加`}\n        </button>\n      </Form>\n      <p className="field-hint">\n        名前やアイコンは共通のまま、戦績・ランキング・実績はこのグループで新しく始まります。\n      </p>\n    </section>\n  );\n}\n`,
);

await replaceOnce(
  "app/routes/game-participant.tsx",
  `  createNewPlayerProfileSessionCredentials,\n  getAuthenticatedPlayerProfile,\n  selectPlayerProfile,`,
  `  createNewPlayerProfileSessionCredentials,\n  getAuthenticatedPlayerIdentity,\n  getAuthenticatedPlayerProfile,\n  selectPlayerProfile,`,
);

await replaceOnce(
  "app/routes/game-participant.tsx",
  `import { joinSelfParticipant } from "@server/services/participant-service.server";`,
  `import {\n  joinCurrentProfileToGroupGame,\n  joinSelfParticipant,\n} from "@server/services/participant-service.server";`,
);

await replaceOnce(
  "app/routes/game-participant.tsx",
  `import { GroupSiteHeader } from "~/components/site-menu";`,
  `import { GroupSiteHeader } from "~/components/site-menu";\nimport { GroupInviteJoinPanel } from "~/components/group-invite-join-panel";`,
);

await replaceOnce(
  "app/routes/game-participant.tsx",
  `  const players =\n    context.game.status === "open" && !participant\n      ? await listRegisteredPlayersForGame(context.group.id, params.gameId)\n      : [];`,
  `  const groupInvitePlayer =\n    context.game.status === "open" &&\n    !participant &&\n    !profileOverview?.profile\n      ? await getAuthenticatedPlayerIdentity(request)\n      : null;\n  const players =\n    context.game.status === "open" && !participant && !groupInvitePlayer\n      ? await listRegisteredPlayersForGame(context.group.id, params.gameId)\n      : [];`,
);

await replaceOnce(
  "app/routes/game-participant.tsx",
  `    authenticatedPlayer: profileOverview?.profile\n      ? {`,
  `    groupInvitePlayer: groupInvitePlayer\n      ? { displayName: groupInvitePlayer.displayName }\n      : null,\n    authenticatedPlayer: profileOverview?.profile\n      ? {`,
);

await replaceOnce(
  "app/routes/game-participant.tsx",
  `  if (intent === "join-self") {`,
  `  if (intent === "join-current-profile-to-group") {\n    if (context.game.status !== "open") {\n      return { error: "現在は参加を受け付けていません。" };\n    }\n    const joined = await joinCurrentProfileToGroupGame(request, {\n      gameId: params.gameId,\n      groupId: context.group.id,\n    });\n    if (!joined.ok) return { error: joined.error };\n    return redirect(`${participantUrl}?notice=group-joined`, { status: 303 });\n  }\n\n  if (intent === "join-self") {`,
);

await replaceOnce(
  "app/routes/game-participant.tsx",
  `            loaderData.authenticatedPlayer ? "join-grid" : "player-selection"`,
  `            loaderData.authenticatedPlayer || loaderData.groupInvitePlayer\n              ? "join-grid"\n              : "player-selection"`,
);

await replaceOnce(
  "app/routes/game-participant.tsx",
  `          {loaderData.authenticatedPlayer ? (\n            <section className="participant-panel">`,
  `          {loaderData.authenticatedPlayer ? (\n            <section className="participant-panel">`,
);

await replaceOnce(
  "app/routes/game-participant.tsx",
  `            </section>\n          ) : (\n            <>\n              <section className="player-selection-primary">`,
  `            </section>\n          ) : loaderData.groupInvitePlayer ? (\n            <GroupInviteJoinPanel\n              displayName={loaderData.groupInvitePlayer.displayName}\n              groupName={loaderData.group.name}\n              isSubmitting={isSubmitting}\n            />\n          ) : (\n            <>\n              <section className="player-selection-primary">`,
);

await replaceOnce(
  "app/routes/game-participant.tsx",
  `    joined: "参加しました。ゲーム中の操作を開始できます。",`,
  `    joined: "参加しました。ゲーム中の操作を開始できます。",\n    "group-joined": "グループに参加し、この開催へ登録しました。",`,
);

await replaceOnce(
  "app/routes/game-participant.test.ts",
  `  getAuthenticatedPlayerProfile: vi.fn(),`,
  `  getAuthenticatedPlayerIdentity: vi.fn(),\n  getAuthenticatedPlayerProfile: vi.fn(),`,
);

await replaceOnce(
  "app/routes/game-participant.test.ts",
  `  joinAuthenticatedParticipant: vi.fn(),`,
  `  joinAuthenticatedParticipant: vi.fn(),\n  joinExistingPlayerToGroupGame: vi.fn(),`,
);

await replaceOnce(
  "app/routes/game-participant.test.ts",
  `  joinAuthenticatedParticipant: mocked.joinAuthenticatedParticipant,\n  joinNewParticipant: mocked.joinNewParticipant,`,
  `  joinAuthenticatedParticipant: mocked.joinAuthenticatedParticipant,\n  joinExistingPlayerToGroupGame: mocked.joinExistingPlayerToGroupGame,\n  joinNewParticipant: mocked.joinNewParticipant,`,
);

await replaceOnce(
  "app/routes/game-participant.test.ts",
  `  getAuthenticatedPlayerProfile: mocked.getAuthenticatedPlayerProfile,`,
  `  getAuthenticatedPlayerIdentity: mocked.getAuthenticatedPlayerIdentity,\n  getAuthenticatedPlayerProfile: mocked.getAuthenticatedPlayerProfile,`,
);

await replaceOnce(
  "app/routes/game-participant.test.ts",
  `    mocked.getAuthenticatedPlayerProfile.mockResolvedValue({\n      group,\n      profile,\n    });`,
  `    mocked.getAuthenticatedPlayerIdentity.mockResolvedValue(null);\n    mocked.getAuthenticatedPlayerProfile.mockResolvedValue({\n      group,\n      profile,\n    });\n    mocked.joinExistingPlayerToGroupGame.mockResolvedValue(groupPlayerId);`,
);

await replaceOnce(
  "app/routes/game-participant.test.ts",
  `  it("参加者一覧の取得失敗だけでは開催ページをエラーにしない", async () => {`,
  `  it("別グループの本人プロフィールがある場合は共有リンクから参加候補として返す", async () => {\n    mocked.getAuthenticatedPlayerProfile.mockResolvedValue({ group, profile: null });\n    mocked.getAuthenticatedPlayerIdentity.mockResolvedValue({\n      displayName: "Alice",\n      playerId,\n    });\n\n    const result = await loader(loaderArgs());\n\n    expect(result.groupInvitePlayer).toEqual({ displayName: "Alice" });\n    expect(mocked.listRegisteredPlayersForGame).not.toHaveBeenCalled();\n  });\n\n  it("参加者一覧の取得失敗だけでは開催ページをエラーにしない", async () => {`,
);

await replaceOnce(
  "app/routes/game-participant.test.ts",
  `  it("join-self actionで認証済みの本人が参加し303で戻る", async () => {`,
  `  it("開催共有リンクから既存プロフィールのまま新グループと開催へ参加できる", async () => {\n    mocked.getAuthenticatedPlayerIdentity.mockResolvedValue({\n      displayName: "Alice",\n      playerId,\n    });\n\n    const result = await action(\n      actionArgs({ intent: "join-current-profile-to-group" }),\n    );\n\n    const response = expectRedirect(result);\n    expect(response.headers.get("Location")).toBe(\n      `/g/river-check/games/${gameId}?notice=group-joined`,\n    );\n    expect(mocked.joinExistingPlayerToGroupGame).toHaveBeenCalledWith(\n      group.id,\n      gameId,\n      playerId,\n      expect.stringMatching(/^[0-9a-f]{64}$/u),\n    );\n  });\n\n  it("join-self actionで認証済みの本人が参加し303で戻る", async () => {`,
);

await writeFile(
  "app/routes/game-link-group-invite-repository.test.ts",
  `import { beforeEach, describe, expect, it, vi } from "vitest";\n\nconst mocked = vi.hoisted(() => ({\n  queryDatabase: vi.fn(),\n  transactionQuery: vi.fn(),\n}));\n\nvi.mock("@server/db/client.server", () => ({\n  queryDatabase: mocked.queryDatabase,\n  withTransaction: vi.fn(async (work) =>\n    work({ query: mocked.transactionQuery }),\n  ),\n}));\n\nimport { findPlayerIdentityBySession } from "@server/repositories/player-profile-repository.server";\nimport { joinExistingPlayerToGroupGame } from "@server/repositories/participant-repository.server";\n\ndescribe("game link group invite repositories", () => {\n  beforeEach(() => vi.resetAllMocks());\n\n  it("プロフィールセッションからgroup未所属でもglobal playerを解決する", async () => {\n    mocked.queryDatabase.mockResolvedValue({\n      rows: [{ player_id: "player-1", display_name: "Alice" }],\n    });\n\n    await expect(findPlayerIdentityBySession("token-hash")).resolves.toEqual({\n      playerId: "player-1",\n      displayName: "Alice",\n    });\n\n    const sql = String(mocked.queryDatabase.mock.calls[0]?.[0]);\n    expect(sql).toContain("player_profile_sessions");\n    expect(sql).not.toContain("group_players");\n  });\n\n  it("open開催をlockして既存playerのgroup所属と参加を同一transactionで作る", async () => {\n    mocked.transactionQuery\n      .mockResolvedValueOnce({ rows: [{ id: "game-1" }] })\n      .mockResolvedValueOnce({ rows: [{ id: "group-player-1" }] })\n      .mockResolvedValueOnce({ rowCount: 1, rows: [] });\n\n    await expect(\n      joinExistingPlayerToGroupGame(\n        "group-1",\n        "game-1",\n        "player-1",\n        "token-hash",\n      ),\n    ).resolves.toBe("group-player-1");\n\n    expect(String(mocked.transactionQuery.mock.calls[0]?.[0])).toContain(\n      "FOR UPDATE",\n    );\n    expect(String(mocked.transactionQuery.mock.calls[1]?.[0])).toContain(\n      "INSERT INTO group_players",\n    );\n    expect(String(mocked.transactionQuery.mock.calls[2]?.[0])).toContain(\n      "INSERT INTO game_participants",\n    );\n  });\n});\n`,
);

await replaceOnce(
  "docs/requirements.md",
  `- プロフィール認証済みplayerは、所属済みの別グループへ切り替えても同じ本人セッションを利用できる\n- 主催者はグループ切替画面から新しいグループを作成できる。`,
  `- プロフィール認証済みplayerは、所属済みの別グループへ切り替えても同じ本人セッションを利用できる\n- プロフィール認証済みplayerが未所属グループのopen開催共有URLを開いた場合は、現在のplayerを新しいgroup_playerとして追加し、その開催への参加まで1操作で完了できる。新しいplayers行は作成しない\n- この招待導線では無効化済みの既存group_playerを本人操作で再有効化せず、主催者による確認を必要とする\n- 主催者はグループ切替画面から新しいグループを作成できる。`,
);

await replaceOnce(
  "docs/architecture.md",
  `グループ作成は既存の\`groups\`と\`group_players\`を利用する。主催者端末がplayerとして認証済みの場合は新group作成transaction内でそのplayerのgroup_playerも作成する。メンバー管理から他groupの既存playerを追加する場合もplayersを複製せずgroup_playersだけを追加する。`,
  `グループ作成は既存の\`groups\`と\`group_players\`を利用する。主催者端末がplayerとして認証済みの場合は新group作成transaction内でそのplayerのgroup_playerも作成する。メンバー管理から他groupの既存playerを追加する場合もplayersを複製せずgroup_playersだけを追加する。\n\n未所属groupのopen開催共有URLを、別groupで本人プロフィール認証済みのplayerが開いた場合は、groupに依存しない有効な\`player_profile_sessions\`からglobal playerを解決する。本人が明示的に参加ボタンを押したPOSTだけで、open開催行をlockしたtransaction内に\`group_players\`を追加し、そのまま\`game_participants\`へ登録する。既存のactive membershipは再利用し、inactive membershipは本人操作で再有効化しない。GET loaderでは所属追加を行わない。`,
);
