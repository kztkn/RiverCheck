from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise RuntimeError(f"expected block not found: {path}")
    p.write_text(text.replace(old, new, 1))


# Repository: update title + date atomically in one SQL statement.
replace_once(
    "server/repositories/game-repository.server.ts",
    '''export async function updateOpenGameTitle(\n  groupId: string,\n  gameId: string,\n  title: string,\n): Promise<boolean> {\n  const result = await queryDatabase(\n    `\n      UPDATE games\n      SET title = $3,\n          updated_at = NOW()\n      WHERE id = $1\n        AND group_id = $2\n        AND status = 'open'\n    `,\n    [gameId, groupId, title],\n  );\n  return result.rowCount === 1;\n}\n''',
    '''export async function updateOpenGameTitle(\n  groupId: string,\n  gameId: string,\n  title: string,\n): Promise<boolean> {\n  const result = await queryDatabase(\n    `\n      UPDATE games\n      SET title = $3,\n          updated_at = NOW()\n      WHERE id = $1\n        AND group_id = $2\n        AND status = 'open'\n    `,\n    [gameId, groupId, title],\n  );\n  return result.rowCount === 1;\n}\n\nexport async function updateOpenGameIdentity(\n  groupId: string,\n  gameId: string,\n  values: { title: string; playedAt: string },\n): Promise<boolean> {\n  const result = await queryDatabase(\n    `\n      UPDATE games\n      SET title = $3,\n          played_at = $4,\n          updated_at = NOW()\n      WHERE id = $1\n        AND group_id = $2\n        AND status = 'open'\n    `,\n    [gameId, groupId, values.title, values.playedAt],\n  );\n  return result.rowCount === 1;\n}\n''',
)

# Service: validate the two fields together, then persist together.
replace_once(
    "server/services/game-service.server.ts",
    '''  deleteOpenGame,\n  insertGame,\n  updateOpenGameTitle,\n} from "@server/repositories/game-repository.server";\n''',
    '''  deleteOpenGame,\n  insertGame,\n  updateOpenGameIdentity,\n  updateOpenGameTitle,\n} from "@server/repositories/game-repository.server";\n''',
)
replace_once(
    "server/services/game-service.server.ts",
    '''export async function renameOpenGameForGroup(\n  groupId: string,\n  gameId: string,\n  value: string,\n): Promise<OpenGameManagementResult> {\n''',
    '''export async function updateOpenGameIdentityForGroup(\n  groupId: string,\n  gameId: string,\n  values: GameIdentityFormValues,\n): Promise<\n  | { ok: true }\n  | { ok: false; errors: GameIdentityFormErrors; error?: string }\n> {\n  const validation = validateGameIdentityForm(values);\n  if (!validation.ok) {\n    return { ok: false, errors: validation.errors };\n  }\n\n  const updated = await updateOpenGameIdentity(\n    groupId,\n    gameId,\n    validation.input,\n  );\n  return updated\n    ? { ok: true }\n    : {\n        ok: false,\n        errors: {},\n        error: "開催設定を保存できませんでした。画面を更新してください。",\n      };\n}\n\nexport async function renameOpenGameForGroup(\n  groupId: string,\n  gameId: string,\n  value: string,\n): Promise<OpenGameManagementResult> {\n''',
)

# Route imports: replace separate title/date actions with one identity action.
replace_once(
    "app/routes/game-admin.tsx",
    '''  removeOpenGameForGroup,\n  renameOpenGameForGroup,\n  type GameSettingsFormValues,\n  validateGameSettingsForm,\n} from "@server/services/game-service.server";\nimport { GAME_TITLE_MAX_LENGTH } from "@domain/game/game-title";\nimport { rescheduleOpenGameForGroup } from "@server/services/game-schedule-service.server";\n''',
    '''  removeOpenGameForGroup,\n  type GameSettingsFormValues,\n  updateOpenGameIdentityForGroup,\n  validateGameSettingsForm,\n} from "@server/services/game-service.server";\nimport { GAME_TITLE_MAX_LENGTH } from "@domain/game/game-title";\n''',
)

route = Path("app/routes/game-admin.tsx")
text = route.read_text()
start = text.index('  if (intent === "rename-game") {')
end = text.index('  if (intent === "delete-game") {', start)
combined_action = '''  if (intent === "update-game-identity") {\n    const title = readString(formData, "title");\n    const playedAt = readString(formData, "playedAt");\n    try {\n      const result = await updateOpenGameIdentityForGroup(\n        authorized.group.id,\n        params.gameId,\n        { title, playedAt },\n      );\n      if (!result.ok) {\n        return {\n          ...result,\n          intent: "update-game-identity" as const,\n          title,\n          playedAt,\n        };\n      }\n    } catch (error) {\n      console.error("Failed to update open game identity", error);\n      return {\n        ok: false as const,\n        intent: "update-game-identity" as const,\n        title,\n        playedAt,\n        errors: {},\n        error:\n          "開催設定を保存できませんでした。画面を更新してもう一度お試しください。",\n      };\n    }\n    return redirect(\n      `/g/${params.groupCode}/games/${params.gameId}/admin?notice=game-settings-updated`,\n      { status: 303 },\n    );\n  }\n\n'''
route.write_text(text[:start] + combined_action + text[end:])

replace_once(
    "app/routes/game-admin.tsx",
    '''  const renameAction =\n    actionData?.ok === false &&\n    "intent" in actionData &&\n    actionData.intent === "rename-game" &&\n    "title" in actionData\n      ? actionData\n      : null;\n  const scheduleAction =\n    actionData?.ok === false &&\n    "intent" in actionData &&\n    actionData.intent === "reschedule-game" &&\n    "playedAt" in actionData\n      ? actionData\n      : null;\n''',
    '''  const gameIdentityAction =\n    actionData?.ok === false &&\n    "intent" in actionData &&\n    actionData.intent === "update-game-identity" &&\n    "title" in actionData &&\n    "playedAt" in actionData\n      ? actionData\n      : null;\n''',
)
replace_once(
    "app/routes/game-admin.tsx",
    '''      (actionData.intent === "save-local-rules" ||\n        actionData.intent === "rename-game" ||\n        actionData.intent === "reschedule-game" ||\n        actionData.intent === "delete-game")\n''',
    '''      (actionData.intent === "save-local-rules" ||\n        actionData.intent === "update-game-identity" ||\n        actionData.intent === "delete-game")\n''',
)
replace_once(
    "app/routes/game-admin.tsx",
    '''  const [gameSettingsOpen, setGameSettingsOpen] = useState(\n    Boolean(renameAction || scheduleAction),\n  );\n''',
    '''  const [gameSettingsOpen, setGameSettingsOpen] = useState(\n    Boolean(gameIdentityAction),\n  );\n''',
)

# Close settings only after a successful save. Validation/server errors keep it open.
replace_once(
    "app/routes/game-admin.tsx",
    '''  useEffect(() => {\n    if (!notice) return;\n    setToast({ id: Date.now(), message: notice, tone: "success" });\n''',
    '''  useEffect(() => {\n    if (!notice) return;\n    if (loaderData.notice === "game-settings-updated") {\n      setGameSettingsOpen(false);\n    }\n    setToast({ id: Date.now(), message: notice, tone: "success" });\n''',
)
replace_once(
    "app/routes/game-admin.tsx",
    '''  }, [notice]);\n''',
    '''  }, [loaderData.notice, notice]);\n''',
)

# UI: one form, one Cancel/Save action row.
route = Path("app/routes/game-admin.tsx")
text = route.read_text()
form_start = text.index('          <Form className="game-title-edit-form" method="post" noValidate>')
danger_start = text.index('          <div className="game-danger-zone">', form_start)
combined_form = '''          <Form className="game-title-edit-form" method="post" noValidate>\n            <input name="intent" type="hidden" value="update-game-identity" />\n            <label className="field">\n              <span className="field-label">開催名</span>\n              <input\n                aria-invalid={gameIdentityAction?.errors.title ? true : undefined}\n                autoComplete="off"\n                defaultValue={gameIdentityAction?.title ?? loaderData.game.title}\n                maxLength={GAME_TITLE_MAX_LENGTH}\n                name="title"\n                required\n                type="text"\n              />\n              {gameIdentityAction?.errors.title ? (\n                <span className="field-error">{gameIdentityAction.errors.title}</span>\n              ) : null}\n            </label>\n            <label className="field">\n              <span className="field-label">開催日</span>\n              <input\n                aria-invalid={gameIdentityAction?.errors.playedAt ? true : undefined}\n                defaultValue={\n                  gameIdentityAction?.playedAt ??\n                  toDateInputValue(loaderData.game.playedAt)\n                }\n                name="playedAt"\n                required\n                type="date"\n              />\n              {gameIdentityAction?.errors.playedAt ? (\n                <span className="field-error">\n                  {gameIdentityAction.errors.playedAt}\n                </span>\n              ) : null}\n            </label>\n            {gameIdentityAction?.error ? (\n              <p className="error-notice" role="alert">\n                {gameIdentityAction.error}\n              </p>\n            ) : null}\n            <div className="dialog-actions">\n              <button\n                className="button button-secondary"\n                onClick={() => setGameSettingsOpen(false)}\n                type="button"\n              >\n                キャンセル\n              </button>\n              <button\n                className="button button-primary"\n                disabled={\n                  navigation.state === "submitting" &&\n                  navigation.formData?.get("intent") === "update-game-identity"\n                }\n                type="submit"\n              >\n                {navigation.state === "submitting" &&\n                navigation.formData?.get("intent") === "update-game-identity"\n                  ? "保存中…"\n                  : "保存"}\n              </button>\n            </div>\n          </Form>\n'''
route.write_text(text[:form_start] + combined_form + text[danger_start:])

replace_once(
    "app/routes/game-admin.tsx",
    '''  if (notice === "game-renamed") return "開催名を変更しました。";\n  if (notice === "game-rescheduled") return "開催日を変更しました。";\n''',
    '''  if (notice === "game-settings-updated") return "開催設定を保存しました。";\n''',
)

# Route test: one save updates both values and redirects to the success notice.
test = Path("app/routes/game-admin-management.test.ts")
text = test.read_text()
text = text.replace('  renameOpenGameForGroup: vi.fn(),\n  rescheduleOpenGameForGroup: vi.fn(),\n', '  updateOpenGameIdentityForGroup: vi.fn(),\n')
text = text.replace('  renameOpenGameForGroup: mocked.renameOpenGameForGroup,\n  validateGameSettingsForm: vi.fn(),\n}));\nvi.mock("@server/services/game-schedule-service.server", () => ({\n  rescheduleOpenGameForGroup: mocked.rescheduleOpenGameForGroup,\n}));\n', '  updateOpenGameIdentityForGroup: mocked.updateOpenGameIdentityForGroup,\n  validateGameSettingsForm: vi.fn(),\n}));\n')
first_test = text.index('  it("主催者認証後に開催名を変更して管理画面へ戻る"')
delete_test = text.index('  it("開催を削除して主催者ホームへ戻り参加者Cookieも消す"', first_test)
new_test = '''  it("開催設定の保存1回で開催名と開催日をまとめて更新する", async () => {\n    mocked.updateOpenGameIdentityForGroup.mockResolvedValue({ ok: true });\n\n    const result = await action(\n      actionArgs({\n        intent: "update-game-identity",\n        title: "9月の会",\n        playedAt: "2026-09-11",\n      }),\n    );\n\n    expect(mocked.requireOrganizer).toHaveBeenCalledWith(\n      expect.any(Request),\n      "river-check",\n    );\n    expect(mocked.updateOpenGameIdentityForGroup).toHaveBeenCalledWith(\n      group.id,\n      game.id,\n      { title: "9月の会", playedAt: "2026-09-11" },\n    );\n    expect(result).toBeInstanceOf(Response);\n    const response = result as Response;\n    expect(response.status).toBe(303);\n    expect(response.headers.get("Location")).toBe(\n      `/g/river-check/games/${game.id}/admin?notice=game-settings-updated`,\n    );\n  });\n\n'''
test.write_text(text[:first_test] + new_test + text[delete_test:])

# Normalize all edited files to exactly one trailing newline.
for path in [
    "server/repositories/game-repository.server.ts",
    "server/services/game-service.server.ts",
    "app/routes/game-admin.tsx",
    "app/routes/game-admin-management.test.ts",
]:
    p = Path(path)
    p.write_text(p.read_text().rstrip() + "\n")
