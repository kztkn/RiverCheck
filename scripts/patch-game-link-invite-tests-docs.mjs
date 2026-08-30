import { writeFile, readFile } from "node:fs/promises";

async function replaceOnce(path, before, after) {
  const source = await readFile(path, "utf8");
  if (!source.includes(before)) {
    throw new Error(`Expected text not found in ${path}: ${before.slice(0, 120)}`);
  }
  await writeFile(path, source.replace(before, after));
}

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
  `  it("開催共有リンクから既存プロフィールのまま新グループと開催へ参加できる", async () => {\n    mocked.getAuthenticatedPlayerIdentity.mockResolvedValue({\n      displayName: "Alice",\n      playerId,\n    });\n\n    const result = await action(\n      actionArgs({ intent: "join-current-profile-to-group" }),\n    );\n\n    const response = expectRedirect(result);\n    expect(response.headers.get("Location")).toBe(\n      "/g/river-check/games/" + gameId + "?notice=group-joined",\n    );\n    expect(mocked.joinExistingPlayerToGroupGame).toHaveBeenCalledWith(\n      group.id,\n      gameId,\n      playerId,\n      expect.stringMatching(/^[0-9a-f]{64}$/u),\n    );\n  });\n\n  it("join-self actionで認証済みの本人が参加し303で戻る", async () => {`,
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
