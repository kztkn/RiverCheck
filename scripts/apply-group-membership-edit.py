from pathlib import Path

repo = Path('server/repositories/player-repository.server.ts')
s = repo.read_text()
s = s.replace(
'''      WHERE group_player.group_id = $1\n      ORDER BY group_player.is_active DESC, display_name ASC, group_player.created_at ASC''',
'''      WHERE group_player.group_id = $1\n        AND group_player.is_active = TRUE\n      ORDER BY display_name ASC, group_player.created_at ASC'''
)
s = s.replace(
'''        AND NOT EXISTS (\n          SELECT 1\n          FROM group_players AS target_membership\n          WHERE target_membership.group_id = $1\n            AND target_membership.player_id = player.id\n        )''',
'''        AND NOT EXISTS (\n          SELECT 1\n          FROM group_players AS target_membership\n          WHERE target_membership.group_id = $1\n            AND target_membership.player_id = player.id\n            AND target_membership.is_active = TRUE\n        )'''
)
s = s.replace(
'''      ON CONFLICT (group_id, player_id) DO NOTHING\n      RETURNING id''',
'''      ON CONFLICT (group_id, player_id) DO UPDATE\n      SET is_active = TRUE\n      RETURNING id'''
)
insert = '''\nexport async function deactivateGroupPlayer(\n  groupId: string,\n  groupPlayerId: string,\n): Promise<boolean> {\n  const result = await queryDatabase(\n    `\n      UPDATE group_players\n      SET is_active = FALSE\n      WHERE group_id = $1\n        AND id = $2\n        AND is_active = TRUE\n    `,\n    [groupId, groupPlayerId],\n  );\n  return result.rowCount === 1;\n}\n'''
s = s.replace('\nfunction mapGroupPlayer(row: GroupPlayerRow): GroupPlayerSummary {', insert + '\nfunction mapGroupPlayer(row: GroupPlayerRow): GroupPlayerSummary {')
repo.write_text(s)

service = Path('server/services/player-service.server.ts')
s = service.read_text()
s = s.replace('  attachExistingPlayerToGroup,\n', '  attachExistingPlayerToGroup,\n  deactivateGroupPlayer,\n')
s = s.replace(
'''export type RenamePlayerResult =\n  | { ok: true }\n  | {\n      ok: false;\n      error: string;\n      value: string;\n    };''',
'''export type RenamePlayerResult =\n  | { ok: true }\n  | {\n      ok: false;\n      error: string;\n      value: string;\n    };\n\nexport type RemovePlayerFromGroupResult =\n  | { ok: true }\n  | { ok: false; error: string };'''
)
insert = '''\nexport async function removePlayerFromGroup(\n  publicCode: string,\n  groupPlayerId: string,\n): Promise<RemovePlayerFromGroupResult> {\n  const group = await findGroupByPublicCode(publicCode);\n  if (!group) return { ok: false, error: "グループが見つかりません。" };\n\n  const removed = await deactivateGroupPlayer(group.id, groupPlayerId);\n  return removed\n    ? { ok: true }\n    : {\n        ok: false,\n        error: "メンバーを確認できません。画面を更新してください。",\n      };\n}\n'''
s = s.replace('\nfunction readString(formData: FormData, name: string): string {', insert + '\nfunction readString(formData: FormData, name: string): string {')
service.write_text(s)

route = Path('app/routes/players.tsx')
s = route.read_text()
s = s.replace('  renamePlayerForGroup,\n', '  renamePlayerForGroup,\n  removePlayerFromGroup,\n')
s = s.replace('    renamed: url.searchParams.has("renamed"),\n', '    renamed: url.searchParams.has("renamed"),\n    removed: url.searchParams.has("removed"),\n')
needle = '''  if (intent === "rename-player") {\n'''
block = '''  if (intent === "remove-player") {\n    const groupPlayerId = readString(formData, "groupPlayerId");\n    if (!isUuid(groupPlayerId)) {\n      return {\n        ok: false as const,\n        intent,\n        error: "メンバーを確認できません。",\n        groupPlayerId,\n      };\n    }\n    const result = await removePlayerFromGroup(params.groupCode, groupPlayerId);\n    if (!result.ok) return { ...result, intent, groupPlayerId };\n    return redirect(`/g/${params.groupCode}/players?removed=1`);\n  }\n\n'''
s = s.replace(needle, block + needle)
s = s.replace(
'''  const renameFailure = actionData?.ok === false &&\n    "intent" in actionData &&\n    actionData.intent === "rename-player"\n      ? actionData\n      : null;''',
'''  const renameFailure = actionData?.ok === false &&\n    "intent" in actionData &&\n    actionData.intent === "rename-player"\n      ? actionData\n      : null;\n  const removeFailure = actionData?.ok === false &&\n    "intent" in actionData &&\n    actionData.intent === "remove-player"\n      ? actionData\n      : null;'''
)
s = s.replace(
'''      <AppToast\n        message={loaderData.renamed ? "表示名を変更しました。" : null}\n        searchParam="renamed"\n      />''',
'''      <AppToast\n        message={loaderData.renamed ? "表示名を変更しました。" : null}\n        searchParam="renamed"\n      />\n\n      <AppToast\n        message={loaderData.removed ? "メンバーをグループから外しました。" : null}\n        searchParam="removed"\n      />'''
)
s = s.replace(
'''                      <div className="member-rename-actions">\n                        <Link''',
'''                      <div className="member-membership-note">\n                        <strong>グループ所属</strong>\n                        <p>外しても過去の開催・順位・戦績は残ります。必要になればあとで再追加できます。</p>\n                        <Form action={actionUrl} method="post" reloadDocument>\n                          <input name="intent" type="hidden" value="remove-player" />\n                          <input name="groupPlayerId" type="hidden" value={player.id} />\n                          <button\n                            className="text-button member-remove-from-group"\n                            disabled={isSubmitting}\n                            onClick={(event) => {\n                              if (!window.confirm(`${player.displayName}さんをこのグループから外しますか？\\n過去の戦績は残ります。`)) {\n                                event.preventDefault();\n                              }\n                            }}\n                            type="submit"\n                          >\n                            このグループから外す\n                          </button>\n                        </Form>\n                        {removeFailure?.groupPlayerId === player.id ? (\n                          <p className="field-error" role="alert">{removeFailure.error}</p>\n                        ) : null}\n                      </div>\n                      <div className="member-rename-actions">\n                        <Link'''
)
route.write_text(s)

css = Path('app/styles/groups.css')
s = css.read_text()
s += '''\n\n.member-membership-note {\n  display: grid;\n  gap: 6px;\n  margin-top: 14px;\n  border-top: 1px solid var(--line);\n  padding-top: 14px;\n}\n\n.member-membership-note strong {\n  font-size: 0.72rem;\n}\n\n.member-membership-note p {\n  margin: 0;\n  color: var(--muted);\n  font-size: 0.68rem;\n  line-height: 1.55;\n}\n\n.member-remove-from-group {\n  justify-self: start;\n  color: #a79a96;\n  font-size: 0.7rem;\n  padding-inline: 0;\n}\n\n.member-remove-from-group:hover,\n.member-remove-from-group:focus-visible {\n  color: var(--red);\n}\n'''
css.write_text(s)

req = Path('docs/requirements.md')
s = req.read_text()
s += '''\n\n### グループ設定・所属編集\n- 管理者はグループ設定からグループ名を変更できる。公開コードとURLは変更しない。\n- 管理者はメンバー管理から現在の所属メンバーをグループから外せる。\n- 所属解除は `group_players.is_active = FALSE` とする論理的な解除で、プレイヤー、過去開催、順位、戦績を削除しない。\n- 外したプレイヤーは再追加でき、その場合は既存の `group_players` を再有効化する。\n- グループ自体の削除機能は提供しない。\n'''
req.write_text(s)

test = Path('app/routes/group-membership-edit.test.ts')
test.write_text('''import { readFileSync } from "node:fs";\nimport { describe, expect, it } from "vitest";\n\ndescribe("group membership editing", () => {\n  it("所属解除はis_activeをfalseにして履歴を保持する", () => {\n    const repository = readFileSync("server/repositories/player-repository.server.ts", "utf8");\n    expect(repository).toContain("SET is_active = FALSE");\n    expect(repository).toContain("ON CONFLICT (group_id, player_id) DO UPDATE");\n    expect(repository).toContain("SET is_active = TRUE");\n  });\n\n  it("メンバー管理に所属解除導線を表示する", () => {\n    const route = readFileSync("app/routes/players.tsx", "utf8");\n    expect(route).toContain("このグループから外す");\n    expect(route).toContain("過去の開催・順位・戦績は残ります");\n    expect(route).toContain('intent === "remove-player"');\n  });\n});\n''')
