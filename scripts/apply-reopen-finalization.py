from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise RuntimeError(f"expected block not found: {path}\n{old[:180]}")
    p.write_text(text.replace(old, new, 1))


# Repository: blocker inspection + destructive steps stay in SQL layer.
repo = Path("server/repositories/finalization-repository.server.ts")
text = repo.read_text()
anchor = '''export async function markGameFinalized(\n  transaction: DatabaseTransaction,\n  groupId: string,\n  gameId: string,\n): Promise<boolean> {\n  const result = await transaction.query(\n    `\n      UPDATE games\n      SET status = 'finalized', finalized_at = NOW(), updated_at = NOW()\n      WHERE id = $1 AND group_id = $2 AND status = 'open'\n    `,\n    [gameId, groupId],\n  );\n  return result.rowCount === 1;\n}\n'''
addition = anchor + '''\nexport interface FinalizationReopenBlockers {\n  hasResultRevisions: boolean;\n  hasCostShareReceipts: boolean;\n  hasStoryPosts: boolean;\n}\n\nexport async function getFinalizationReopenBlockers(\n  transaction: DatabaseTransaction,\n  gameId: string,\n): Promise<FinalizationReopenBlockers> {\n  const result = await transaction.query<{\n    has_result_revisions: boolean;\n    has_cost_share_receipts: boolean;\n    has_story_posts: boolean;\n  }>(\n    `\n      SELECT\n        EXISTS (\n          SELECT 1\n          FROM game_result_revisions\n          WHERE game_id = $1\n        ) AS has_result_revisions,\n        EXISTS (\n          SELECT 1\n          FROM game_cost_share_receipts\n          WHERE game_id = $1\n        ) AS has_cost_share_receipts,\n        EXISTS (\n          SELECT 1\n          FROM game_story_posts AS story\n          INNER JOIN game_participants AS participant\n            ON participant.id = story.game_participant_id\n          WHERE participant.game_id = $1\n        ) AS has_story_posts\n    `,\n    [gameId],\n  );\n  const row = result.rows[0];\n  if (!row) throw new Error("failed to inspect finalization reopen blockers");\n  return {\n    hasResultRevisions: row.has_result_revisions,\n    hasCostShareReceipts: row.has_cost_share_receipts,\n    hasStoryPosts: row.has_story_posts,\n  };\n}\n\nexport async function deleteFinalResultsForReopen(\n  transaction: DatabaseTransaction,\n  gameId: string,\n): Promise<void> {\n  await transaction.query("DELETE FROM game_results WHERE game_id = $1", [gameId]);\n}\n\nexport async function markGameOpenAfterFinalization(\n  transaction: DatabaseTransaction,\n  groupId: string,\n  gameId: string,\n): Promise<boolean> {\n  const result = await transaction.query(\n    `\n      UPDATE games\n      SET status = 'open', finalized_at = NULL, updated_at = NOW()\n      WHERE id = $1 AND group_id = $2 AND status = 'finalized'\n    `,\n    [gameId, groupId],\n  );\n  return result.rowCount === 1;\n}\n'''
if "getFinalizationReopenBlockers" not in text:
    if anchor not in text:
        raise RuntimeError("markGameFinalized anchor not found")
    repo.write_text(text.replace(anchor, addition, 1))

# Service: only pristine finalized games can be reopened; preserve participant inputs/rebuy history.
replace_once(
    "server/services/finalization-service.server.ts",
    '''  insertFinalResults,\n  insertResultRevision,\n  lockGameForFinalization,\n''',
    '''  deleteFinalResultsForReopen,\n  getFinalizationReopenBlockers,\n  insertFinalResults,\n  insertResultRevision,\n  lockGameForFinalization,\n''',
)
replace_once(
    "server/services/finalization-service.server.ts",
    '''  lockParticipantsForFinalization,\n  markGameFinalized,\n''',
    '''  lockParticipantsForFinalization,\n  markGameFinalized,\n  markGameOpenAfterFinalization,\n''',
)
service = Path("server/services/finalization-service.server.ts")
text = service.read_text()
marker = '''export interface ResultCorrectionInput {\n'''
reopen = '''export type ReopenFinalizedGameResult =\n  | { ok: true }\n  | { ok: false; error: string };\n\nexport async function reopenFinalizedGame(\n  groupId: string,\n  gameId: string,\n): Promise<ReopenFinalizedGameResult> {\n  return withTransaction(async (transaction) => {\n    const game = await lockGameForFinalization(transaction, groupId, gameId);\n    if (!game) return { ok: false, error: "開催が見つかりません。" };\n    if (game.status !== "finalized") {\n      return { ok: false, error: "確定済みの開催だけ確定を取り消せます。" };\n    }\n\n    const participants = await lockParticipantsForFinalization(transaction, gameId);\n    const blockers = await getFinalizationReopenBlockers(transaction, gameId);\n    const blockerLabels = [\n      blockers.hasResultRevisions ? "結果訂正履歴" : null,\n      blockers.hasCostShareReceipts ? "会費受取記録" : null,\n      blockers.hasStoryPosts ? "TABLE STORIES" : null,\n    ].filter((label): label is string => label !== null);\n    if (blockerLabels.length > 0) {\n      return {\n        ok: false,\n        error: `確定後のデータ（${blockerLabels.join("・")}）があるため、確定を取り消せません。`,\n      };\n    }\n\n    const results = await lockFinalResults(transaction, gameId);\n    const participantIds = new Set(\n      participants.map((participant) => participant.group_player_id),\n    );\n    if (\n      results.length < 4 ||\n      participants.length !== results.length ||\n      results.some((result) => !participantIds.has(result.groupPlayerId))\n    ) {\n      return {\n        ok: false,\n        error: "確定データの整合性を確認できないため、確定を取り消せません。",\n      };\n    }\n\n    const affectedGroupPlayerIds = results.map((result) => result.groupPlayerId);\n    await deleteFinalResultsForReopen(transaction, gameId);\n    if (!(await markGameOpenAfterFinalization(transaction, groupId, gameId))) {\n      throw new Error("game status changed during finalization reopen");\n    }\n    await awardAchievementsForPlayers(\n      transaction,\n      groupId,\n      affectedGroupPlayerIds,\n    );\n    return { ok: true };\n  });\n}\n\n'''
if "export async function reopenFinalizedGame" not in text:
    if marker not in text:
        raise RuntimeError("ResultCorrectionInput marker not found")
    service.write_text(text.replace(marker, reopen + marker, 1))

# Route: organizer-only finalized edit page gets the guarded action and danger-zone control.
replace_once(
    "app/routes/game-edit.tsx",
    '''import { redirect, useNavigation } from "react-router";\n''',
    '''import { Form, redirect, useNavigation } from "react-router";\nimport { useEffect, useRef, useState } from "react";\n''',
)
replace_once(
    "app/routes/game-edit.tsx",
    '''import {\n  updateFinalizedGame,\n  type ResultCorrectionInput,\n} from "@server/services/finalization-service.server";\n''',
    '''import {\n  reopenFinalizedGame,\n  updateFinalizedGame,\n  type ResultCorrectionInput,\n} from "@server/services/finalization-service.server";\n''',
)
replace_once(
    "app/routes/game-edit.tsx",
    '''  const resultUrl = `/g/${params.groupCode}/games/${params.gameId}`;\n\n  if (intent === "save-game-identity") {\n''',
    '''  const resultUrl = `/g/${params.groupCode}/games/${params.gameId}`;\n\n  if (intent === "reopen-finalization") {\n    const result = await reopenFinalizedGame(context.group.id, params.gameId);\n    if (!result.ok) {\n      return { ...result, intent: "reopen-finalization" as const };\n    }\n    return redirect(\n      `/g/${params.groupCode}/games/${params.gameId}/admin?notice=finalization-reopened`,\n      { status: 303 },\n    );\n  }\n\n  if (intent === "save-game-identity") {\n''',
)
replace_once(
    "app/routes/game-edit.tsx",
    '''  const identityAction =\n    actionData?.ok === false && actionData.intent === "save-game-identity"\n      ? actionData\n      : null;\n''',
    '''  const identityAction =\n    actionData?.ok === false && actionData.intent === "save-game-identity"\n      ? actionData\n      : null;\n  const reopenAction =\n    actionData?.ok === false && actionData.intent === "reopen-finalization"\n      ? actionData\n      : null;\n''',
)
replace_once(
    "app/routes/game-edit.tsx",
    '''      <ResultCorrectionPanel\n        actionUrl={editUrl}\n        cancelUrl={resultUrl}\n        error={correctionAction?.error ?? null}\n        game={loaderData.game}\n        isSubmitting={isSubmitting}\n        results={loaderData.results}\n      />\n    </main>\n''',
    '''      <ResultCorrectionPanel\n        actionUrl={editUrl}\n        cancelUrl={resultUrl}\n        error={correctionAction?.error ?? null}\n        game={loaderData.game}\n        isSubmitting={isSubmitting}\n        results={loaderData.results}\n      />\n\n      <ReopenFinalizationControl\n        error={reopenAction?.error ?? null}\n        gameTitle={loaderData.game.title}\n        isSubmitting={\n          isSubmitting &&\n          navigation.formData?.get("intent") === "reopen-finalization"\n        }\n      />\n    </main>\n''',
)
route = Path("app/routes/game-edit.tsx")
text = route.read_text()
component_marker = '''async function requireGame(groupCode: string, gameId: string) {\n'''
component = '''function ReopenFinalizationControl({\n  error,\n  gameTitle,\n  isSubmitting,\n}: {\n  error: string | null;\n  gameTitle: string;\n  isSubmitting: boolean;\n}) {\n  const [isOpen, setIsOpen] = useState(Boolean(error));\n  const dialogRef = useRef<HTMLDialogElement>(null);\n\n  useEffect(() => {\n    const dialog = dialogRef.current;\n    if (!dialog) return;\n    if (isOpen && !dialog.open) dialog.showModal();\n    if (!isOpen && dialog.open) dialog.close();\n  }, [isOpen]);\n\n  return (\n    <section className="game-danger-zone" aria-labelledby="reopen-finalization-heading">\n      <div>\n        <strong id="reopen-finalization-heading">結果確定を取り消す</strong>\n        <p>誤って確定したときだけ、参加者入力を残したまま受付中へ戻します。</p>\n      </div>\n      <button\n        className="game-delete-trigger"\n        onClick={() => setIsOpen(true)}\n        type="button"\n      >\n        確定を取り消す\n      </button>\n      <dialog\n        aria-labelledby="reopen-finalization-dialog-title"\n        className="app-dialog"\n        onCancel={() => setIsOpen(false)}\n        onClick={(event) => {\n          if (event.target === event.currentTarget) setIsOpen(false);\n        }}\n        onClose={() => setIsOpen(false)}\n        ref={dialogRef}\n      >\n        <div className="dialog-card">\n          <span aria-hidden="true" className="dialog-danger-icon">!</span>\n          <div>\n            <p className="eyebrow">REOPEN GAME</p>\n            <h2 id="reopen-finalization-dialog-title">結果確定を取り消しますか？</h2>\n            <p>\n              <strong>{gameTitle}</strong> を受付中へ戻します。確定結果は削除し、\n              実績は残っている確定開催から再計算します。参加者、リバイ履歴、終了時入力は残ります。\n            </p>\n            <p>\n              結果訂正、会費受取、TABLE STORIESがある開催は安全のため取り消せません。\n              送信済みの通知は取り消せず、再確定すると結果通知がもう一度送られます。\n            </p>\n          </div>\n          {error ? <p className="error-notice" role="alert">{error}</p> : null}\n          <div className="dialog-actions">\n            <button\n              autoFocus\n              className="button button-secondary"\n              disabled={isSubmitting}\n              onClick={() => setIsOpen(false)}\n              type="button"\n            >\n              キャンセル\n            </button>\n            <Form method="post">\n              <input name="intent" type="hidden" value="reopen-finalization" />\n              <button\n                className="button button-danger"\n                disabled={isSubmitting}\n                type="submit"\n              >\n                {isSubmitting ? "取消中…" : "結果確定を取り消す"}\n              </button>\n            </Form>\n          </div>\n        </div>\n      </dialog>\n    </section>\n  );\n}\n\n'''
if "function ReopenFinalizationControl" not in text:
    if component_marker not in text:
        raise RuntimeError("requireGame marker not found")
    route.write_text(text.replace(component_marker, component + component_marker, 1))

# Admin toast after successful reopen.
admin = Path("app/routes/game-admin.tsx")
text = admin.read_text()
notice_anchor = '  if (notice === "game-settings-updated") return "開催設定を保存しました。";\n'
if 'notice === "finalization-reopened"' not in text:
    if notice_anchor not in text:
        raise RuntimeError("game-admin notice anchor not found")
    admin.write_text(text.replace(
        notice_anchor,
        notice_anchor + '  if (notice === "finalization-reopened") return "結果確定を取り消しました。";\n',
        1,
    ))

# Tests: service behavior + repository SQL guards.
Path("app/routes/finalization-reopen.test.ts").write_text('''import { beforeEach, describe, expect, it, vi } from "vitest";\n\nconst mocked = vi.hoisted(() => ({\n  awardAchievementsForPlayers: vi.fn(),\n  deleteFinalResultsForReopen: vi.fn(),\n  getFinalizationReopenBlockers: vi.fn(),\n  lockFinalResults: vi.fn(),\n  lockGameForFinalization: vi.fn(),\n  lockParticipantsForFinalization: vi.fn(),\n  markGameOpenAfterFinalization: vi.fn(),\n}));\n\nvi.mock("@server/db/client.server", () => ({\n  withTransaction: vi.fn(async (callback) => callback({ query: vi.fn() })),\n}));\nvi.mock("@server/repositories/finalization-repository.server", () => ({\n  ...mocked,\n}));\nvi.mock("@server/services/achievement-service.server", () => ({\n  awardAchievementsForPlayers: mocked.awardAchievementsForPlayers,\n}));\nvi.mock("@server/services/push-notification-service.server", () => ({\n  notifyGameFinalized: vi.fn(),\n}));\nvi.mock("@server/repositories/game-cost-share-receipt-repository.server", () => ({\n  clearChangedCostShareReceipts: vi.fn(),\n}));\n\nimport { reopenFinalizedGame } from "@server/services/finalization-service.server";\n\nconst game = {\n  id: "game-1", groupId: "group-1", title: "Test",\n  playedAt: "2026-09-03T00:00:00.000Z", status: "finalized" as const,\n  initialChips: 20000, rebuyChips: 20000, previewParticipantCount: 4,\n  venueCost: 0, firstPlaceCost: 0, secondPlaceCost: 0, thirdPlaceCost: 0,\n  costShares: [0, 0, 0, 0], sevenDeuceRuleEnabled: true, bombPotRuleEnabled: true,\n};\nconst ids = ["p1", "p2", "p3", "p4"];\n\nbeforeEach(() => {\n  vi.clearAllMocks();\n  mocked.lockGameForFinalization.mockResolvedValue(game);\n  mocked.lockParticipantsForFinalization.mockResolvedValue(\n    ids.map((id) => ({ group_player_id: id })),\n  );\n  mocked.getFinalizationReopenBlockers.mockResolvedValue({\n    hasResultRevisions: false,\n    hasCostShareReceipts: false,\n    hasStoryPosts: false,\n  });\n  mocked.lockFinalResults.mockResolvedValue(\n    ids.map((id, index) => ({ groupPlayerId: id, rank: index + 1 })),\n  );\n  mocked.markGameOpenAfterFinalization.mockResolvedValue(true);\n});\n\ndescribe("reopenFinalizedGame", () => {\n  it("removes only final results, reopens the game, and recalculates achievements", async () => {\n    await expect(reopenFinalizedGame("group-1", "game-1")).resolves.toEqual({ ok: true });\n    expect(mocked.deleteFinalResultsForReopen).toHaveBeenCalledWith(expect.anything(), "game-1");\n    expect(mocked.markGameOpenAfterFinalization).toHaveBeenCalledWith(\n      expect.anything(), "group-1", "game-1",\n    );\n    expect(mocked.awardAchievementsForPlayers).toHaveBeenCalledWith(\n      expect.anything(), "group-1", ids,\n    );\n  });\n\n  it.each([\n    ["hasResultRevisions", "結果訂正履歴"],\n    ["hasCostShareReceipts", "会費受取記録"],\n    ["hasStoryPosts", "TABLE STORIES"],\n  ] as const)("blocks reopen when %s exists", async (key, label) => {\n    mocked.getFinalizationReopenBlockers.mockResolvedValue({\n      hasResultRevisions: false,\n      hasCostShareReceipts: false,\n      hasStoryPosts: false,\n      [key]: true,\n    });\n    const result = await reopenFinalizedGame("group-1", "game-1");\n    expect(result).toEqual({\n      ok: false,\n      error: expect.stringContaining(label),\n    });\n    expect(mocked.deleteFinalResultsForReopen).not.toHaveBeenCalled();\n    expect(mocked.markGameOpenAfterFinalization).not.toHaveBeenCalled();\n  });\n\n  it("fails closed when participant and result sets are inconsistent", async () => {\n    mocked.lockFinalResults.mockResolvedValue(\n      ids.slice(0, 3).map((id, index) => ({ groupPlayerId: id, rank: index + 1 })),\n    );\n    await expect(reopenFinalizedGame("group-1", "game-1")).resolves.toEqual({\n      ok: false,\n      error: "確定データの整合性を確認できないため、確定を取り消せません。",\n    });\n    expect(mocked.deleteFinalResultsForReopen).not.toHaveBeenCalled();\n  });\n});\n''')

Path("app/routes/finalization-reopen-repository.test.ts").write_text('''import { describe, expect, it, vi } from "vitest";\nimport type { DatabaseTransaction } from "@server/db/client.server";\nimport {\n  deleteFinalResultsForReopen,\n  getFinalizationReopenBlockers,\n  markGameOpenAfterFinalization,\n} from "@server/repositories/finalization-repository.server";\n\nfunction tx(query: ReturnType<typeof vi.fn>): DatabaseTransaction {\n  return { query } as unknown as DatabaseTransaction;\n}\n\ndescribe("finalization reopen repository", () => {\n  it("checks revisions, receipts and stories for the target game", async () => {\n    const query = vi.fn().mockResolvedValue({ rows: [{\n      has_result_revisions: true, has_cost_share_receipts: false, has_story_posts: true,\n    }] });\n    await expect(getFinalizationReopenBlockers(tx(query), "game-1")).resolves.toEqual({\n      hasResultRevisions: true, hasCostShareReceipts: false, hasStoryPosts: true,\n    });\n    const sql = String(query.mock.calls[0]?.[0]);\n    expect(sql).toContain("game_result_revisions");\n    expect(sql).toContain("game_cost_share_receipts");\n    expect(sql).toContain("game_story_posts");\n    expect(sql).toContain("game_participants");\n  });\n\n  it("deletes results and only reopens a finalized game", async () => {\n    const query = vi.fn()\n      .mockResolvedValueOnce({ rowCount: 4, rows: [] })\n      .mockResolvedValueOnce({ rowCount: 1, rows: [] });\n    await deleteFinalResultsForReopen(tx(query), "game-1");\n    await expect(markGameOpenAfterFinalization(tx(query), "group-1", "game-1")).resolves.toBe(true);\n    expect(String(query.mock.calls[0]?.[0])).toContain("DELETE FROM game_results");\n    const updateSql = String(query.mock.calls[1]?.[0]);\n    expect(updateSql).toContain("status = 'open'");\n    expect(updateSql).toContain("finalized_at = NULL");\n    expect(updateSql).toContain("status = 'finalized'");\n  });\n});\n''')

# Document the deliberately narrow safety boundary.
for path in ["docs/requirements.md", "docs/domain-rules.md"]:
    p = Path(path)
    text = p.read_text().rstrip()
    heading = "## 結果確定の取り消し"
    if heading not in text:
        text += '''\n\n## 結果確定の取り消し\n\n主催者は、誤操作で確定した開催に限り、参加者・リバイ履歴・終了時入力を保持したまま確定結果を削除して受付中へ戻せる。取り消し時は対象開催の`game_results`を削除し、`games.status`を`open`、`finalized_at`をNULLへ戻したうえで、対象参加者の実績を残存する確定開催から再計算する。確定時に保存した会費設定は保持する。\n\n結果訂正履歴、会費受取記録、TABLE STORIESのいずれかが確定後に存在する開催は、安全のため確定を取り消せない。送信済みPush通知は取り消さず、再確定時は通常どおり結果確定通知を送る。\n'''
        p.write_text(text + "\n")

for path in [
    "server/repositories/finalization-repository.server.ts",
    "server/services/finalization-service.server.ts",
    "app/routes/game-edit.tsx",
    "app/routes/game-admin.tsx",
    "app/routes/finalization-reopen.test.ts",
    "app/routes/finalization-reopen-repository.test.ts",
    "docs/requirements.md",
    "docs/domain-rules.md",
]:
    p = Path(path)
    p.write_text(p.read_text().rstrip() + "\n")
