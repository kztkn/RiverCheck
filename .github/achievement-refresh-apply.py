from pathlib import Path


def must_replace(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"expected text not found in {path}: {old[:100]!r}")
    p.write_text(text.replace(old, new, 1))


repo = Path("server/repositories/achievement-repository.server.ts")
text = repo.read_text()
text = text.replace("  is_equipped: boolean;\n}", "  is_equipped: boolean;\n  achievements_dirty: boolean;\n}", 1)
text = text.replace(
    "): Promise<void> {\n  if (playerUnlocks.length === 0) return;\n  await transaction.query(\n",
    "): Promise<number> {\n  if (playerUnlocks.length === 0) return 0;\n  const result = await transaction.query(\n",
    1,
)
needle = "    ],\n  );\n}\n\nexport async function listPlayerAchievementCollection(\n"
insert = """    ],
  );
  return result.rowCount ?? 0;
}

export async function markAchievementRefreshNeeded(
  transaction: DatabaseTransaction,
  groupId: string,
  groupPlayerIds: string[],
): Promise<void> {
  const uniquePlayerIds = [...new Set(groupPlayerIds)];
  if (uniquePlayerIds.length === 0) return;
  await transaction.query(
    `
      UPDATE group_players
      SET achievements_dirty = TRUE
      WHERE group_id = $1
        AND id = ANY($2::UUID[])
    `,
    [groupId, uniquePlayerIds],
  );
}

export async function lockAchievementRefreshTargets(
  transaction: DatabaseTransaction,
  groupId: string,
  groupPlayerIds: string[],
): Promise<string[]> {
  const uniquePlayerIds = [...new Set(groupPlayerIds)];
  if (uniquePlayerIds.length === 0) return [];
  const result = await transaction.query<{ id: string }>(
    `
      SELECT id
      FROM group_players
      WHERE group_id = $1
        AND id = ANY($2::UUID[])
      ORDER BY id
      FOR UPDATE
    `,
    [groupId, uniquePlayerIds],
  );
  return result.rows.map((row) => row.id);
}

export async function clearAchievementRefreshNeeded(
  transaction: DatabaseTransaction,
  groupId: string,
  groupPlayerIds: string[],
): Promise<void> {
  if (groupPlayerIds.length === 0) return;
  await transaction.query(
    `
      UPDATE group_players
      SET achievements_dirty = FALSE
      WHERE group_id = $1
        AND id = ANY($2::UUID[])
    `,
    [groupId, groupPlayerIds],
  );
}

export async function listPlayerAchievementCollection(
"""
if needle not in text:
    raise SystemExit("repository insertion point not found")
text = text.replace(needle, insert, 1)
text = text.replace(
    "): Promise<PlayerAchievementCollection> {\n",
    "): Promise<PlayerAchievementCollection & { needsRefresh: boolean }> {\n",
    1,
)
text = text.replace(
    "        SELECT id, equipped_achievement_id\n",
    "        SELECT id, equipped_achievement_id, achievements_dirty\n",
    1,
)
text = text.replace(
    "        achievement.is_hidden,\n        player_achievement.unlocked_at,\n",
    "        achievement.is_hidden,\n        target_player.achievements_dirty,\n        player_achievement.unlocked_at,\n",
    1,
)
text = text.replace(
    "  return {\n    unlockedCount: items.filter((item) => item.isUnlocked).length,\n",
    "  return {\n    needsRefresh: result.rows[0]?.achievements_dirty ?? false,\n    unlockedCount: items.filter((item) => item.isUnlocked).length,\n",
    1,
)
repo.write_text(text)

must_replace(
    "server/services/finalization-service.server.ts",
    'import {\n  awardAchievementsForPlayers,\n  scheduleAchievementRefresh,\n} from "@server/services/achievement-service.server";',
    'import {\n  awardAchievementsForPlayers,\n  markAchievementsDirtyBestEffort,\n  refreshAchievementsBestEffort,\n} from "@server/services/achievement-service.server";',
)
must_replace(
    "server/services/finalization-service.server.ts",
    '  scheduleAchievementRefresh(group.id, finalized.achievementPlayerIds, {\n    reason: "finalization",\n    gameId,\n  });\n\n  try {',
    '  // Results are already committed. Achievement work may delay this response,\n  // but a failure must never turn a valid result into a failed finalization.\n  await markAchievementsDirtyBestEffort(\n    group.id,\n    finalized.achievementPlayerIds,\n    { reason: "finalization", gameId },\n  );\n  await refreshAchievementsBestEffort(\n    group.id,\n    finalized.achievementPlayerIds,\n    { reason: "finalization", gameId },\n  );\n\n  try {',
)

test = Path("app/routes/game-finalized-notification.test.ts")
text = test.read_text()
text = text.replace(
    "  notifyGameFinalized: vi.fn(),\n  scheduleAchievements: vi.fn(),\n  saveCostSettings: vi.fn(),",
    "  markAchievementsDirty: vi.fn(),\n  notifyGameFinalized: vi.fn(),\n  refreshAchievements: vi.fn(),\n  saveCostSettings: vi.fn(),",
    1,
)
text = text.replace(
    'vi.mock("@server/services/achievement-service.server", () => ({\n  awardAchievementsForPlayers: vi.fn(),\n  scheduleAchievementRefresh: mocked.scheduleAchievements,\n}));',
    'vi.mock("@server/services/achievement-service.server", () => ({\n  awardAchievementsForPlayers: vi.fn(),\n  markAchievementsDirtyBestEffort: mocked.markAchievementsDirty,\n  refreshAchievementsBestEffort: mocked.refreshAchievements,\n}));',
    1,
)
text = text.replace(
    '    mocked.scheduleAchievements.mockImplementation(() => {\n      mocked.events.push("achievements");\n    });',
    '    mocked.markAchievementsDirty.mockImplementation(async () => {\n      mocked.events.push("achievements-dirty");\n      return true;\n    });\n    mocked.refreshAchievements.mockImplementation(async () => {\n      mocked.events.push("achievements");\n      return true;\n    });',
    1,
)
text = text.replace(
    'expect(mocked.events).toEqual(["committed", "achievements", "notified"]);',
    'expect(mocked.events).toEqual([\n      "committed",\n      "achievements-dirty",\n      "achievements",\n      "notified",\n    ]);',
    1,
)
marker = '  it("通知失敗でも確定結果を成功として返す", async () => {'
addition = """  it("称号更新失敗でも確定結果を成功として返す", async () => {
    mocked.refreshAchievements.mockImplementation(async () => {
      mocked.events.push("achievements-failed");
      return false;
    });

    await expect(
      finalizeGame(group, gameId, settings, false, false),
    ).resolves.toEqual({ ok: true });
    expect(mocked.events).toEqual([
      "committed",
      "achievements-dirty",
      "achievements-failed",
      "notified",
    ]);
  });

"""
if marker not in text:
    raise SystemExit("notification test marker not found")
test.write_text(text.replace(marker, addition + marker, 1))

repo_test = Path("app/routes/achievement-repository.test.ts")
text = repo_test.read_text()
text = text.replace(
    "  insertAchievementUnlocks,\n  listAchievementHistoryGames,\n  listAchievementReactionSummaries,",
    "  clearAchievementRefreshNeeded,\n  insertAchievementUnlocks,\n  listAchievementHistoryGames,\n  listAchievementReactionSummaries,\n  lockAchievementRefreshTargets,\n  markAchievementRefreshNeeded,",
    1,
)
marker = '  it("loads finalized result, table-event, and story facts in one history query", async () => {'
addition = """  it("marks, locks, and clears achievement refresh state", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ id: "player-1" }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });
    const transaction = transactionWith(query);

    await markAchievementRefreshNeeded(transaction, "group-1", ["player-1"]);
    await expect(lockAchievementRefreshTargets(
      transaction,
      "group-1",
      ["player-1"],
    )).resolves.toEqual(["player-1"]);
    await clearAchievementRefreshNeeded(transaction, "group-1", ["player-1"]);

    expect(String(query.mock.calls[0]?.[0])).toContain("achievements_dirty = TRUE");
    expect(String(query.mock.calls[1]?.[0])).toContain("FOR UPDATE");
    expect(String(query.mock.calls[2]?.[0])).toContain("achievements_dirty = FALSE");
  });

"""
if marker not in text:
    raise SystemExit("repository test marker not found")
repo_test.write_text(text.replace(marker, addition + marker, 1))

must_replace(
    "docs/requirements.md",
    "- 結果確定ではgame_results保存とgameのfinalized化を先にtransactionでcommitし、称号再評価はCloudflare `waitUntil`へ登録してレスポンスを待たせない。判定は称号ごとにSQLを増やさず、確定履歴・テーブルイベント・STORIESをまとめた集約query、リアクション集約query、batch INSERTで行う",
    "- 結果確定ではgame_results保存とgameのfinalized化を先にtransactionでcommitすることを最優先とし、commit後に称号再評価を同期で1回待つ。称号更新の失敗は結果確定を失敗扱いにせず、対象プレイヤーの再評価フラグを残す。個人ページの称号コレクションは通常は読取りだけとし、再評価フラグが残っている場合だけ自己修復してフラグを解除する。称号再評価は開始・成功・失敗と処理時間・新規獲得件数をWorkerログへ残す。判定は称号ごとにSQLを増やさず、確定履歴・テーブルイベント・STORIESをまとめた集約query、リアクション集約query、batch INSERTで行う",
)
must_replace(
    "docs/architecture.md",
    "service が `pg` の client を取得して `BEGIN` し、gameと参加者行をロックする。全員の入力と4人以上の参加を確認し、domain関数で検算、点数、順位、負担額を計算する。差分がある場合は主催者の確認を必須にする。game_resultsへのINSERT、gameのfinalized更新、現在の確定済み履歴に基づく実績同期を同一transactionで実行し、途中失敗時はrollbackする。",
    "service が `pg` の client を取得して `BEGIN` し、gameと参加者行をロックする。全員の入力と2人以上の参加を確認し、domain関数で検算、点数、順位、負担額を計算する。差分がある場合は主催者の確認を必須にする。game_resultsへのINSERTとgameのfinalized更新を同一transactionでcommitし、ここを結果確定の成功条件とする。commit後に対象playerの`achievements_dirty`をbest effortで立て、実績再評価を同期で1回待つ。実績再評価が失敗しても確定結果は成功のままとし、dirtyが残っていれば次回の称号コレクション読取り時だけ再評価して自己修復する。正常時の個人ページでは実績再計算を行わない。",
)
