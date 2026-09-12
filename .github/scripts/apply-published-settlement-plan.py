from pathlib import Path


def replace(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"pattern not found in {path}: {old[:80]!r}")
    p.write_text(text.replace(old, new, 1))

# types/game.ts
replace(
    "types/game.ts",
    "  costShares: number[] | null;\n  sevenDeuceRuleEnabled: boolean;",
    "  costShares: number[] | null;\n  settlementPlanPublishedAt: string | null;\n  sevenDeuceRuleEnabled: boolean;",
)

# game repository
replace(
    "server/repositories/game-repository.server.ts",
    "  cost_shares: string[] | null;\n  seven_deuce_rule_enabled: boolean;",
    "  cost_shares: string[] | null;\n  settlement_plan_published_at: Date | null;\n  seven_deuce_rule_enabled: boolean;",
)
replace(
    "server/repositories/game-repository.server.ts",
    "        cost_shares,\n        seven_deuce_rule_enabled,",
    "        cost_shares,\n        settlement_plan_published_at,\n        seven_deuce_rule_enabled,",
)
replace(
    "server/repositories/game-repository.server.ts",
    "    costShares: mapCostShares(row.cost_shares),\n    sevenDeuceRuleEnabled: row.seven_deuce_rule_enabled,",
    "    costShares: mapCostShares(row.cost_shares),\n    settlementPlanPublishedAt:\n      row.settlement_plan_published_at?.toISOString() ?? null,\n    sevenDeuceRuleEnabled: row.seven_deuce_rule_enabled,",
)
insert_after = "export async function updateLocalRules(\n"
p = Path("server/repositories/game-repository.server.ts")
text = p.read_text()
idx = text.index(insert_after)
method = '''export async function publishSettlementPlan(\n  groupId: string,\n  gameId: string,\n  input: Pick<\n    CreateGameInput,\n    | "venueCost"\n    | "firstPlaceCost"\n    | "secondPlaceCost"\n    | "thirdPlaceCost"\n    | "previewParticipantCount"\n    | "costShares"\n  >,\n): Promise<boolean> {\n  const result = await queryDatabase(\n    `\n      UPDATE games\n      SET venue_cost = $3,\n          rounding_unit = 100,\n          first_place_cost = $4,\n          second_place_cost = $5,\n          third_place_cost = $6,\n          preview_participant_count = $7,\n          cost_shares = $8::BIGINT[],\n          settlement_plan_published_at = NOW(),\n          updated_at = NOW()\n      WHERE id = $1\n        AND group_id = $2\n        AND status = 'open'\n    `,\n    [\n      gameId,\n      groupId,\n      input.venueCost,\n      input.firstPlaceCost,\n      input.secondPlaceCost,\n      input.thirdPlaceCost,\n      input.previewParticipantCount,\n      input.costShares,\n    ],\n  );\n  return result.rowCount === 1;\n}\n\n'''
p.write_text(text[:idx] + method + text[idx:])

# finalization repository mapping
replace(
    "server/repositories/finalization-repository.server.ts",
    "  cost_shares: string[] | null;\n  seven_deuce_rule_enabled: boolean;",
    "  cost_shares: string[] | null;\n  settlement_plan_published_at: Date | null;\n  seven_deuce_rule_enabled: boolean;",
)
replace(
    "server/repositories/finalization-repository.server.ts",
    "             cost_shares, seven_deuce_rule_enabled, bomb_pot_rule_enabled",
    "             cost_shares, settlement_plan_published_at,\n             seven_deuce_rule_enabled, bomb_pot_rule_enabled",
)
replace(
    "server/repositories/finalization-repository.server.ts",
    "    costShares: row.cost_shares?.map((value) => Number(value)) ?? null,\n    sevenDeuceRuleEnabled: row.seven_deuce_rule_enabled,",
    "    costShares: row.cost_shares?.map((value) => Number(value)) ?? null,\n    settlementPlanPublishedAt:\n      row.settlement_plan_published_at?.toISOString() ?? null,\n    sevenDeuceRuleEnabled: row.seven_deuce_rule_enabled,",
)

# Admin route import + action + UI
replace(
    "app/routes/game-admin.tsx",
    "  findGameForGroup,\n  updateLocalRules,",
    "  findGameForGroup,\n  publishSettlementPlan,\n  updateLocalRules,",
)
replace(
    "app/routes/game-admin.tsx",
    "  if (intent === \"finalize\") {\n",
    '''  if (intent === "publish-settlement-plan") {\n    const values = readAdminCostSettingsForm(formData, authorized.game);\n    const validation = validateGameSettingsForm(values);\n    if (!validation.ok) {\n      const messages = [\n        ...new Set(\n          Object.values(validation.errors).filter(\n            (message): message is string => Boolean(message),\n          ),\n        ),\n      ];\n      return {\n        ok: false as const,\n        intent: "publish-settlement-plan" as const,\n        error: `精算設定を確認してください。${messages.join(" ")}`,\n        errors: validation.errors,\n        values,\n      };\n    }\n    const published = await publishSettlementPlan(\n      authorized.group.id,\n      params.gameId,\n      validation.input,\n    );\n    if (!published) {\n      return {\n        ok: false as const,\n        intent: "publish-settlement-plan" as const,\n        error: "精算予定を公開できませんでした。画面を更新してください。",\n        errors: {},\n        values,\n      };\n    }\n    return redirect(\n      `/g/${params.groupCode}/games/${params.gameId}/admin?notice=settlement-plan-published`,\n      { status: 303 },\n    );\n  }\n\n  if (intent === "finalize") {\n''',
)
replace(
    "app/routes/game-admin.tsx",
    "          <input name=\"intent\" type=\"hidden\" value=\"finalize\" />\n          <GameSettingsFields",
    "          <GameSettingsFields",
)
replace(
    "app/routes/game-admin.tsx",
    "            isSubmitting={isSubmitting}\n            settlementParticipantCount={settlementParticipantCount}\n          />",
    "            isSubmitting={isSubmitting}\n            publishedAt={loaderData.game.settlementPlanPublishedAt}\n            settlementParticipantCount={settlementParticipantCount}\n            submittingIntent={\n              typeof navigation.formData?.get(\"intent\") === \"string\"\n                ? String(navigation.formData?.get(\"intent\"))\n                : null\n            }\n          />",
)
replace(
    "app/routes/game-admin.tsx",
    "  if (notice === \"local-rules-saved\") return \"ローカルルールを保存しました。\";",
    "  if (notice === \"local-rules-saved\") return \"ローカルルールを保存しました。\";\n  if (notice === \"settlement-plan-published\") return \"今日の精算予定を参加者に公開しました。\";",
)
replace(
    "app/routes/game-admin.tsx",
    '''function FinalizationPanel({\n  error,\n  finalization,\n  isSubmitting,\n  settlementParticipantCount,\n}: {\n  error: string | null;\n  finalization: Route.ComponentProps["loaderData"]["finalization"];\n  isSubmitting: boolean;\n  settlementParticipantCount: string;\n}) {''',
    '''function FinalizationPanel({\n  error,\n  finalization,\n  isSubmitting,\n  publishedAt,\n  settlementParticipantCount,\n  submittingIntent,\n}: {\n  error: string | null;\n  finalization: Route.ComponentProps["loaderData"]["finalization"];\n  isSubmitting: boolean;\n  publishedAt: string | null;\n  settlementParticipantCount: string;\n  submittingIntent: string | null;\n}) {''',
)
replace(
    "app/routes/game-admin.tsx",
    '''        <button\n          className="button button-primary"\n          disabled={\n            !finalization.canFinalize ||\n            !participantCountMatches ||\n            isSubmitting ||\n            (hasDifference && !differenceConfirmed) ||\n            (hasRebuyMismatch && !rebuyMismatchConfirmed)\n          }\n          type="submit"\n        >\n          {isSubmitting ? "処理中…" : "この精算設定で結果を確定"}\n        </button>''',
    '''        <button\n          className="button button-secondary"\n          disabled={isSubmitting}\n          name="intent"\n          type="submit"\n          value="publish-settlement-plan"\n        >\n          {submittingIntent === "publish-settlement-plan"\n            ? "公開中…"\n            : publishedAt\n              ? "公開内容を更新"\n              : "参加者に公開"}\n        </button>\n        {publishedAt ? (\n          <p className="field-hint">現在の精算予定は参加者に公開中です。</p>\n        ) : null}\n        <button\n          className="button button-primary"\n          disabled={\n            !finalization.canFinalize ||\n            !participantCountMatches ||\n            isSubmitting ||\n            (hasDifference && !differenceConfirmed) ||\n            (hasRebuyMismatch && !rebuyMismatchConfirmed)\n          }\n          name="intent"\n          type="submit"\n          value="finalize"\n        >\n          {submittingIntent === "finalize"\n            ? "処理中…"\n            : "この精算設定で結果を確定"}\n        </button>''',
)

# Participant UI: add plan sheet beside local rules for both pre-join and seated users
replace(
    "app/routes/game-participant.tsx",
    '''      {shouldShowLocalRules(loaderData.game.status) && !loaderData.participant ? (\n        <LocalRulesSheet\n          bombPotRuleEnabled={loaderData.game.bombPotRuleEnabled}\n          sevenDeuceRuleEnabled={loaderData.game.sevenDeuceRuleEnabled}\n        />\n      ) : null}''',
    '''      {shouldShowLocalRules(loaderData.game.status) && !loaderData.participant ? (\n        <>\n          <LocalRulesSheet\n            bombPotRuleEnabled={loaderData.game.bombPotRuleEnabled}\n            sevenDeuceRuleEnabled={loaderData.game.sevenDeuceRuleEnabled}\n          />\n          {loaderData.game.settlementPlanPublishedAt && loaderData.game.costShares ? (\n            <SettlementPlanSheet\n              costShares={loaderData.game.costShares}\n              participantCount={loaderData.game.previewParticipantCount}\n              venueCost={loaderData.game.venueCost}\n            />\n          ) : null}\n        </>\n      ) : null}''',
)
replace(
    "app/routes/game-participant.tsx",
    '''          <LocalRulesSheet\n            bombPotRuleEnabled={loaderData.game.bombPotRuleEnabled}\n            sevenDeuceRuleEnabled={loaderData.game.sevenDeuceRuleEnabled}\n          />''',
    '''          <LocalRulesSheet\n            bombPotRuleEnabled={loaderData.game.bombPotRuleEnabled}\n            sevenDeuceRuleEnabled={loaderData.game.sevenDeuceRuleEnabled}\n          />\n          {loaderData.game.settlementPlanPublishedAt && loaderData.game.costShares ? (\n            <SettlementPlanSheet\n              costShares={loaderData.game.costShares}\n              participantCount={loaderData.game.previewParticipantCount}\n              venueCost={loaderData.game.venueCost}\n            />\n          ) : null}''',
)
marker = "export function shouldShowLocalRules(status: GameStatus): boolean {\n"
p = Path("app/routes/game-participant.tsx")
text = p.read_text()
idx = text.index(marker)
component = '''export function SettlementPlanSheet({\n  costShares,\n  participantCount,\n  venueCost,\n}: {\n  costShares: number[];\n  participantCount: number;\n  venueCost: number;\n}) {\n  const [isOpen, setIsOpen] = useState(false);\n  const dialogRef = useRef<HTMLDialogElement>(null);\n  const triggerRef = useRef<HTMLButtonElement>(null);\n\n  useEffect(() => {\n    const dialog = dialogRef.current;\n    if (!dialog) return;\n    if (isOpen && !dialog.open) dialog.showModal();\n    else if (!isOpen && dialog.open) dialog.close();\n  }, [isOpen]);\n\n  function closeSheet() {\n    setIsOpen(false);\n  }\n\n  return (\n    <div className="local-rules-entry settlement-plan-entry">\n      <button\n        aria-controls="settlement-plan-dialog"\n        aria-expanded={isOpen}\n        aria-haspopup="dialog"\n        className="rebuy-rules-trigger local-rules-trigger"\n        onClick={() => setIsOpen(true)}\n        ref={triggerRef}\n        type="button"\n      >\n        <span>今日の精算予定</span>\n        <span aria-hidden="true">›</span>\n      </button>\n      <dialog\n        aria-labelledby="settlement-plan-title"\n        className="app-dialog participant-roster-dialog rebuy-rules-dialog"\n        id="settlement-plan-dialog"\n        onCancel={closeSheet}\n        onClick={(event) => {\n          if (event.target === event.currentTarget) closeSheet();\n        }}\n        onClose={() => {\n          setIsOpen(false);\n          triggerRef.current?.focus();\n        }}\n        ref={dialogRef}\n      >\n        <div className="participant-roster-sheet rebuy-rules-sheet">\n          <header className="participant-roster-header">\n            <div>\n              <p className="eyebrow">SETTLEMENT PLAN</p>\n              <h2 id="settlement-plan-title">今日の精算予定</h2>\n            </div>\n            <button\n              aria-label="精算予定を閉じる"\n              className="participant-roster-close"\n              onClick={closeSheet}\n              type="button"\n            >\n              <svg aria-hidden="true" viewBox="0 0 24 24">\n                <path d="M6 6l12 12M18 6L6 18" />\n              </svg>\n            </button>\n          </header>\n          <div className="participant-roster-scroll rebuy-rules-content">\n            <p className="rebuy-rules-note">\n              会場費 {venueCost.toLocaleString("ja-JP")}円 ・ {participantCount}人想定\n            </p>\n            <ol className="rebuy-rules-list settlement-plan-list">\n              {costShares.map((share, index) => (\n                <li key={index}>\n                  <strong>{index + 1}位</strong>\n                  <span>{share.toLocaleString("ja-JP")}円</span>\n                </li>\n              ))}\n            </ol>\n          </div>\n        </div>\n      </dialog>\n    </div>\n  );\n}\n\n'''
p.write_text(text[:idx] + component + text[idx:])

# Docs
for path, addition in [
    ("docs/requirements.md", "\n## 開催中の精算予定公開\n- 主催者は精算プレビューの現在値を参加者へ明示的に公開できる。\n- 編集中の localStorage ドラフトは公開されず、「参加者に公開」「公開内容を更新」を押した時だけ games の精算設定へ反映する。\n- 参加者は開催中に「今日の精算予定」から順位別負担額を確認できる。\n- 他参加者のリバイ回数はこの機能では公開しない。\n"),
    ("docs/domain-rules.md", "\n## 精算予定の公開\n- settlement_plan_published_at が設定されている open 開催だけ、参加者へ games の venue_cost / preview_participant_count / cost_shares を公開する。\n- 公開操作は精算ドラフトを検証後に保存し、編集中の localStorage 値は共有しない。\n- 最終確定時は従来どおり最新の精算設定で games と game_results を確定する。\n"),
]:
    p = Path(path)
    p.write_text(p.read_text().rstrip() + "\n" + addition)

# Lightweight source regression tests
Path("app/routes/settlement-plan-publication.test.ts").write_text('''import { describe, expect, it } from "vitest";\nimport { readFileSync } from "node:fs";\n\ndescribe("settlement plan publication UX", () => {\n  it("publishes a validated settlement plan from the admin screen", () => {\n    const source = readFileSync("app/routes/game-admin.tsx", "utf8");\n    expect(source).toContain('value="publish-settlement-plan"');\n    expect(source).toContain("publishSettlementPlan");\n    expect(source).toContain("参加者に公開");\n    expect(source).toContain("公開内容を更新");\n  });\n\n  it("shows published settlement plans to participants", () => {\n    const source = readFileSync("app/routes/game-participant.tsx", "utf8");\n    expect(source).toContain("SettlementPlanSheet");\n    expect(source).toContain("今日の精算予定");\n    expect(source).toContain("settlementPlanPublishedAt");\n  });\n});\n''')
