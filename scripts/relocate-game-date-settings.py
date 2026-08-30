from pathlib import Path


def replace_once(path: str, old: str, new: str, applied_marker: str) -> None:
    file_path = Path(path)
    text = file_path.read_text()
    if old in text:
        file_path.write_text(text.replace(old, new, 1))
        return
    if applied_marker in text:
        return
    raise RuntimeError(f"expected source block not found: {path}")


# game-admin: move date reschedule action/UI into the existing settings dialog.
replace_once(
    "app/routes/game-admin.tsx",
    'import { GAME_TITLE_MAX_LENGTH } from "@domain/game/game-title";\n',
    'import { GAME_TITLE_MAX_LENGTH } from "@domain/game/game-title";\nimport { rescheduleOpenGameForGroup } from "@server/services/game-schedule-service.server";\n',
    'rescheduleOpenGameForGroup',
)

replace_once(
    "app/routes/game-admin.tsx",
    '''  if (intent === "delete-game") {\n''',
    '''  if (intent === "reschedule-game") {\n    const playedAt = readString(formData, "playedAt");\n    try {\n      const result = await rescheduleOpenGameForGroup(\n        params.groupCode,\n        params.gameId,\n        playedAt,\n      );\n      if (!result.ok) {\n        return {\n          ...result,\n          intent: "reschedule-game" as const,\n        };\n      }\n    } catch (error) {\n      console.error("Failed to reschedule open game", error);\n      return {\n        ok: false as const,\n        intent: "reschedule-game" as const,\n        playedAt,\n        error:\n          "開催日を変更できませんでした。画面を更新してもう一度お試しください。",\n      };\n    }\n    return redirect(\n      `/g/${params.groupCode}/games/${params.gameId}/admin?notice=game-rescheduled`,\n      { status: 303 },\n    );\n  }\n\n  if (intent === "delete-game") {\n''',
    'intent === "reschedule-game"',
)

replace_once(
    "app/routes/game-admin.tsx",
    '''  const deleteAction =\n    actionData?.ok === false &&\n    "intent" in actionData &&\n    actionData.intent === "delete-game"\n      ? actionData\n      : null;\n''',
    '''  const scheduleAction =\n    actionData?.ok === false &&\n    "intent" in actionData &&\n    actionData.intent === "reschedule-game" &&\n    "playedAt" in actionData\n      ? actionData\n      : null;\n  const deleteAction =\n    actionData?.ok === false &&\n    "intent" in actionData &&\n    actionData.intent === "delete-game"\n      ? actionData\n      : null;\n''',
    'const scheduleAction =',
)

replace_once(
    "app/routes/game-admin.tsx",
    '''      (actionData.intent === "save-local-rules" ||\n        actionData.intent === "rename-game" ||\n        actionData.intent === "delete-game")\n''',
    '''      (actionData.intent === "save-local-rules" ||\n        actionData.intent === "rename-game" ||\n        actionData.intent === "reschedule-game" ||\n        actionData.intent === "delete-game")\n''',
    'actionData.intent === "reschedule-game" ||',
)

replace_once(
    "app/routes/game-admin.tsx",
    '''  const [gameSettingsOpen, setGameSettingsOpen] = useState(\n    Boolean(renameAction),\n  );\n''',
    '''  const [gameSettingsOpen, setGameSettingsOpen] = useState(\n    Boolean(renameAction || scheduleAction),\n  );\n''',
    'Boolean(renameAction || scheduleAction)',
)

replace_once(
    "app/routes/game-admin.tsx",
    '''    if (gameSettingsOpen && !dialog.open) {\n      dialog.showModal();\n''',
    '''    if (gameSettingsOpen && !dialog.open) {\n      dialog.showModal();\n      dialog.focus({ preventScroll: true });\n''',
    'dialog.focus({ preventScroll: true });',
)

replace_once(
    "app/routes/game-admin.tsx",
    '''        ref={gameSettingsDialogRef}\n      >\n''',
    '''        ref={gameSettingsDialogRef}\n        tabIndex={-1}\n      >\n''',
    'tabIndex={-1}',
)

replace_once(
    "app/routes/game-admin.tsx",
    '''            <p>参加者用リンクはそのまま、開催名だけを変更できます。</p>\n''',
    '''            <p>参加者用リンクはそのまま、開催名と開催日を変更できます。</p>\n''',
    '開催名と開催日を変更できます。',
)

rename_form = '''          <Form className="game-title-edit-form" method="post" noValidate>\n            <input name="intent" type="hidden" value="rename-game" />\n            <label className="field">\n              <span className="field-label">開催名</span>\n              <input\n                aria-invalid={renameAction ? true : undefined}\n                autoComplete="off"\n                defaultValue={renameAction?.title ?? loaderData.game.title}\n                maxLength={GAME_TITLE_MAX_LENGTH}\n                name="title"\n                required\n                type="text"\n              />\n              {renameAction ? (\n                <span className="field-error">{renameAction.error}</span>\n              ) : null}\n            </label>\n            <div className="dialog-actions">\n              <button\n                className="button button-secondary"\n                onClick={() => setGameSettingsOpen(false)}\n                type="button"\n              >\n                キャンセル\n              </button>\n              <button\n                className="button button-primary"\n                disabled={\n                  navigation.state === "submitting" &&\n                  navigation.formData?.get("intent") === "rename-game"\n                }\n                type="submit"\n              >\n                {navigation.state === "submitting" &&\n                navigation.formData?.get("intent") === "rename-game"\n                  ? "保存中…"\n                  : "開催名を保存"}\n              </button>\n            </div>\n          </Form>\n'''
rename_and_date_forms = rename_form + '''          <Form className="game-title-edit-form" method="post" noValidate>\n            <input name="intent" type="hidden" value="reschedule-game" />\n            <label className="field">\n              <span className="field-label">開催日</span>\n              <input\n                aria-invalid={scheduleAction ? true : undefined}\n                defaultValue={\n                  scheduleAction?.playedAt ?? toDateInputValue(loaderData.game.playedAt)\n                }\n                name="playedAt"\n                required\n                type="date"\n              />\n              {scheduleAction ? (\n                <span className="field-error">{scheduleAction.error}</span>\n              ) : null}\n            </label>\n            <div className="dialog-actions">\n              <button\n                className="button button-secondary"\n                onClick={() => setGameSettingsOpen(false)}\n                type="button"\n              >\n                キャンセル\n              </button>\n              <button\n                className="button button-primary"\n                disabled={\n                  navigation.state === "submitting" &&\n                  navigation.formData?.get("intent") === "reschedule-game"\n                }\n                type="submit"\n              >\n                {navigation.state === "submitting" &&\n                navigation.formData?.get("intent") === "reschedule-game"\n                  ? "保存中…"\n                  : "開催日を保存"}\n              </button>\n            </div>\n          </Form>\n'''
replace_once(
    "app/routes/game-admin.tsx",
    rename_form,
    rename_and_date_forms,
    'value="reschedule-game"',
)

replace_once(
    "app/routes/game-admin.tsx",
    '''function noticeText(notice: string | null): string | null {\n''',
    '''function toDateInputValue(playedAt: string): string {\n  const parts = new Intl.DateTimeFormat("en-CA", {\n    year: "numeric",\n    month: "2-digit",\n    day: "2-digit",\n    timeZone: "Asia/Tokyo",\n  }).formatToParts(new Date(playedAt));\n  const part = (type: "year" | "month" | "day") =>\n    parts.find((entry) => entry.type === type)?.value ?? "";\n  return `${part("year")}-${part("month")}-${part("day")}`;\n}\n\nfunction noticeText(notice: string | null): string | null {\n''',
    'function toDateInputValue(playedAt: string)',
)

replace_once(
    "app/routes/game-admin.tsx",
    '''  if (notice === "game-renamed") return "開催名を変更しました。";\n''',
    '''  if (notice === "game-renamed") return "開催名を変更しました。";\n  if (notice === "game-rescheduled") return "開催日を変更しました。";\n''',
    'notice === "game-rescheduled"',
)

# group-manage: keep only navigation/listing; date editing now lives in game settings.
replace_once(
    "app/routes/group-manage.tsx",
    'import { Form, Link, redirect, useNavigation } from "react-router";\n',
    'import { Link } from "react-router";\n',
    'import { Link } from "react-router";',
)
replace_once(
    "app/routes/group-manage.tsx",
    'import { rescheduleOpenGameForGroup } from "@server/services/game-schedule-service.server";\n',
    '',
    'import { Link } from "react-router";',
)

start = 'export async function action({ request, params }: Route.ActionArgs) {'
end = 'export default function GroupManage({\n  loaderData,\n  actionData,\n}: Route.ComponentProps) {'
text = Path("app/routes/group-manage.tsx").read_text()
if start in text:
    start_index = text.index(start)
    end_index = text.index(end)
    text = text[:start_index] + 'export default function GroupManage({ loaderData }: Route.ComponentProps) {' + text[end_index + len(end):]
    Path("app/routes/group-manage.tsx").write_text(text)
elif 'export default function GroupManage({ loaderData }: Route.ComponentProps)' not in text:
    raise RuntimeError("group-manage action block not found")

replace_once(
    "app/routes/group-manage.tsx",
    '''  const navigation = useNavigation();\n  const activeGames = orderActiveGamesBySchedule(games);\n  const pastGames = games.filter((game) => game.status === "finalized");\n  const scheduleAction =\n    actionData?.ok === false && actionData.intent === "reschedule-game"\n      ? actionData\n      : null;\n''',
    '''  const activeGames = orderActiveGamesBySchedule(games);\n  const pastGames = games.filter((game) => game.status === "finalized");\n''',
    'const activeGames = orderActiveGamesBySchedule(games);',
)

replace_once(
    "app/routes/group-manage.tsx",
    '''          loaderData.notice === "game-deleted"\n            ? "開催を削除しました。"\n            : loaderData.notice === "game-rescheduled"\n              ? "開催日を変更しました。"\n              : loaderData.notice === "group-created"\n                ? "グループを作成しました。"\n                : null\n''',
    '''          loaderData.notice === "game-deleted"\n            ? "開催を削除しました。"\n            : loaderData.notice === "group-created"\n              ? "グループを作成しました。"\n              : null\n''',
    'loaderData.notice === "group-created"',
)

map_start = '''            {activeGames.map((game) => {\n              const gameScheduleError =\n                scheduleAction && scheduleAction.gameId === game.id\n                  ? scheduleAction\n                  : null;\n              return (\n                <div className="organizer-game-entry" key={game.id}>\n                  <ManageGameRow game={game} groupCode={group.publicCode} />\n                  <details\n                    className="organizer-game-schedule"\n                    open={gameScheduleError ? true : undefined}\n                  >\n                    <summary>開催日を変更</summary>\n                    <Form className="organizer-game-schedule-form" method="post">\n                      <input name="intent" type="hidden" value="reschedule-game" />\n                      <input name="gameId" type="hidden" value={game.id} />\n                      <label className="field">\n                        <span className="field-label">開催日</span>\n                        <input\n                          aria-invalid={gameScheduleError ? true : undefined}\n                          defaultValue={\n                            gameScheduleError?.playedAt ??\n                            toDateInputValue(game.playedAt)\n                          }\n                          name="playedAt"\n                          required\n                          type="date"\n                        />\n                      </label>\n                      {gameScheduleError ? (\n                        <p className="field-error" role="alert">\n                          {gameScheduleError.error}\n                        </p>\n                      ) : null}\n                      <button\n                        className="button button-secondary button-small"\n                        disabled={\n                          navigation.state === "submitting" &&\n                          navigation.formData?.get("intent") === "reschedule-game" &&\n                          navigation.formData?.get("gameId") === game.id\n                        }\n                        type="submit"\n                      >\n                        {navigation.state === "submitting" &&\n                        navigation.formData?.get("intent") === "reschedule-game" &&\n                        navigation.formData?.get("gameId") === game.id\n                          ? "変更中…"\n                          : "日付を保存"}\n                      </button>\n                    </Form>\n                  </details>\n                </div>\n              );\n            })}\n'''
map_new = '''            {activeGames.map((game) => (\n              <ManageGameRow\n                game={game}\n                groupCode={group.publicCode}\n                key={game.id}\n              />\n            ))}\n'''
replace_once(
    "app/routes/group-manage.tsx",
    map_start,
    map_new,
    '{activeGames.map((game) => (',
)

helper_start = '''function toDateInputValue(playedAt: string): string {\n  const parts = new Intl.DateTimeFormat("en-CA", {\n    year: "numeric",\n    month: "2-digit",\n    day: "2-digit",\n    timeZone: "Asia/Tokyo",\n  }).formatToParts(new Date(playedAt));\n  const part = (type: "year" | "month" | "day") =>\n    parts.find((entry) => entry.type === type)?.value ?? "";\n  return `${part("year")}-${part("month")}-${part("day")}`;\n}\n\nfunction readString(formData: FormData, name: string): string {\n  const value = formData.get(name);\n  return typeof value === "string" ? value : "";\n}\n'''
replace_once(
    "app/routes/group-manage.tsx",
    helper_start,
    '',
    'function formatGameDate(playedAt: string)',
)

# Remove dead styles for the list-level date editor.
styles = Path("app/styles/groups.css")
styles_text = styles.read_text()
style_block = '''\n.organizer-game-entry {\n  border-bottom: 1px solid var(--line);\n}\n\n.organizer-game-entry .organizer-game-row {\n  border-bottom: 0;\n}\n\n.organizer-game-schedule {\n  border-top: 1px solid rgba(255, 255, 255, 0.04);\n}\n\n.organizer-game-schedule > summary {\n  display: flex;\n  min-height: 42px;\n  align-items: center;\n  justify-content: flex-end;\n  color: var(--muted);\n  cursor: pointer;\n  font-size: 0.72rem;\n  font-weight: 800;\n  list-style: none;\n  padding: 0 4px;\n}\n\n.organizer-game-schedule > summary::-webkit-details-marker {\n  display: none;\n}\n\n.organizer-game-schedule[open] > summary {\n  color: var(--green);\n}\n\n.organizer-game-schedule-form {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr) auto;\n  align-items: end;\n  gap: 10px;\n  padding: 0 2px 14px;\n}\n\n.organizer-game-schedule-form .field {\n  margin: 0;\n}\n\n.organizer-game-schedule-form .field-error {\n  grid-column: 1 / -1;\n  margin: 0;\n}\n'''
mobile_style = '''\n  .organizer-game-schedule-form {\n    grid-template-columns: 1fr;\n  }\n\n  .organizer-game-schedule-form .button {\n    width: 100%;\n  }\n'''
if style_block in styles_text:
    styles_text = styles_text.replace(style_block, '', 1)
if mobile_style in styles_text:
    styles_text = styles_text.replace(mobile_style, '', 1)
styles.write_text(styles_text)

# Route action test: date changes now belong to game-admin.
replace_once(
    "app/routes/game-admin-management.test.ts",
    '''  renameOpenGameForGroup: vi.fn(),\n  requireOrganizer: vi.fn(),\n''',
    '''  renameOpenGameForGroup: vi.fn(),\n  rescheduleOpenGameForGroup: vi.fn(),\n  requireOrganizer: vi.fn(),\n''',
    'rescheduleOpenGameForGroup: vi.fn()',
)
replace_once(
    "app/routes/game-admin-management.test.ts",
    '''vi.mock("@server/services/finalization-service.server", () => ({\n''',
    '''vi.mock("@server/services/game-schedule-service.server", () => ({\n  rescheduleOpenGameForGroup: mocked.rescheduleOpenGameForGroup,\n}));\nvi.mock("@server/services/finalization-service.server", () => ({\n''',
    '@server/services/game-schedule-service.server',
)
replace_once(
    "app/routes/game-admin-management.test.ts",
    '''  it("開催を削除して主催者ホームへ戻り参加者Cookieも消す", async () => {\n''',
    '''  it("開催設定から開催日を変更して管理画面へ戻る", async () => {\n    mocked.rescheduleOpenGameForGroup.mockResolvedValue({ ok: true });\n\n    const result = await action(\n      actionArgs({ intent: "reschedule-game", playedAt: "2026-09-11" }),\n    );\n\n    expect(mocked.rescheduleOpenGameForGroup).toHaveBeenCalledWith(\n      "river-check",\n      game.id,\n      "2026-09-11",\n    );\n    expect(result).toBeInstanceOf(Response);\n    const response = result as Response;\n    expect(response.status).toBe(303);\n    expect(response.headers.get("Location")).toBe(\n      `/g/river-check/games/${game.id}/admin?notice=game-rescheduled`,\n    );\n  });\n\n  it("開催を削除して主催者ホームへ戻り参加者Cookieも消す", async () => {\n''',
    '開催設定から開催日を変更して管理画面へ戻る',
)
