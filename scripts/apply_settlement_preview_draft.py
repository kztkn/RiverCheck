from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text()
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"Expected one match in {path}, found {count}: {old[:80]!r}")
    file_path.write_text(text.replace(old, new, 1))


# Shared local draft helper.
Path("app/utils/settlement-preview-draft.ts").write_text(
    '''export type SettlementDraftRecommendationMode =\n  | "podium"\n  | "standard"\n  | "gentle"\n  | "simple";\n\nexport type SettlementDraftAdjustmentMode = "top-three" | "individual";\n\nexport interface SettlementPreviewDraft {\n  version: 1;\n  venueCost: string;\n  participantCount: string;\n  shareValues: string[];\n  recommendationMode: SettlementDraftRecommendationMode;\n  adjustmentMode: SettlementDraftAdjustmentMode;\n}\n\nconst recommendationModes = new Set<SettlementDraftRecommendationMode>([\n  "podium",\n  "standard",\n  "gentle",\n  "simple",\n]);\nconst adjustmentModes = new Set<SettlementDraftAdjustmentMode>([\n  "top-three",\n  "individual",\n]);\n\nexport function buildSettlementPreviewDraftStorageKey(\n  groupCode: string,\n  gameId: string,\n): string {\n  return `rivercheck:settlement-preview:v1:${groupCode}:${gameId}`;\n}\n\nexport function parseSettlementPreviewDraft(\n  raw: string | null,\n): SettlementPreviewDraft | null {\n  if (!raw) return null;\n  try {\n    const value = JSON.parse(raw) as Partial<SettlementPreviewDraft> | null;\n    if (!value || value.version !== 1) return null;\n    if (typeof value.venueCost !== "string") return null;\n    if (typeof value.participantCount !== "string") return null;\n    if (\n      !Array.isArray(value.shareValues) ||\n      value.shareValues.length > 100 ||\n      value.shareValues.some((share) => typeof share !== "string")\n    ) {\n      return null;\n    }\n    if (\n      !recommendationModes.has(\n        value.recommendationMode as SettlementDraftRecommendationMode,\n      ) ||\n      !adjustmentModes.has(\n        value.adjustmentMode as SettlementDraftAdjustmentMode,\n      )\n    ) {\n      return null;\n    }\n    return {\n      version: 1,\n      venueCost: value.venueCost,\n      participantCount: value.participantCount,\n      shareValues: [...value.shareValues],\n      recommendationMode:\n        value.recommendationMode as SettlementDraftRecommendationMode,\n      adjustmentMode: value.adjustmentMode as SettlementDraftAdjustmentMode,\n    };\n  } catch {\n    return null;\n  }\n}\n\nexport function hasSameSettlementPreviewValues(\n  left: SettlementPreviewDraft,\n  right: SettlementPreviewDraft,\n): boolean {\n  return (\n    left.venueCost === right.venueCost &&\n    left.participantCount === right.participantCount &&\n    left.shareValues.length === right.shareValues.length &&\n    left.shareValues.every((share, index) => share === right.shareValues[index])\n  );\n}\n'''
)

Path("app/utils/settlement-preview-draft.test.ts").write_text(
    '''import { describe, expect, it } from "vitest";\nimport {\n  buildSettlementPreviewDraftStorageKey,\n  hasSameSettlementPreviewValues,\n  parseSettlementPreviewDraft,\n  type SettlementPreviewDraft,\n} from "./settlement-preview-draft";\n\nconst draft: SettlementPreviewDraft = {\n  version: 1,\n  venueCost: "12000",\n  participantCount: "6",\n  shareValues: ["0", "1000", "1500", "3000", "3000", "3500"],\n  recommendationMode: "standard",\n  adjustmentMode: "top-three",\n};\n\ndescribe("settlement preview draft", () => {\n  it("開催ごとに安定したlocalStorage keyを作る", () => {\n    expect(\n      buildSettlementPreviewDraftStorageKey(\n        "river-check",\n        "22222222-2222-4222-8222-222222222222",\n      ),\n    ).toBe(\n      "rivercheck:settlement-preview:v1:river-check:22222222-2222-4222-8222-222222222222",\n    );\n  });\n\n  it("正しい下書きを復元する", () => {\n    expect(parseSettlementPreviewDraft(JSON.stringify(draft))).toEqual(draft);\n  });\n\n  it("壊れた下書きは無視する", () => {\n    expect(parseSettlementPreviewDraft("not-json")).toBeNull();\n    expect(\n      parseSettlementPreviewDraft(\n        JSON.stringify({ ...draft, recommendationMode: "unknown" }),\n      ),\n    ).toBeNull();\n  });\n\n  it("正式設定と同じ金額・人数・配分なら下書き扱いにしない", () => {\n    expect(\n      hasSameSettlementPreviewValues(draft, {\n        ...draft,\n        recommendationMode: "gentle",\n        adjustmentMode: "individual",\n      }),\n    ).toBe(true);\n    expect(\n      hasSameSettlementPreviewValues(draft, {\n        ...draft,\n        shareValues: [...draft.shareValues.slice(0, -1), "3600"],\n      }),\n    ).toBe(false);\n  });\n});\n'''
)

# GameSettingsFields: optional admin-only local draft support.
replace_once(
    "app/components/game-settings-fields.tsx",
    '''import {\n  recommendTopCosts,\n  recommendTopCostsForAttendance,\n  type RecommendationMode,\n} from "@domain/cost-sharing/recommend-top-costs";\n''',
    '''import {\n  recommendTopCosts,\n  recommendTopCostsForAttendance,\n  type RecommendationMode,\n} from "@domain/cost-sharing/recommend-top-costs";\nimport {\n  hasSameSettlementPreviewValues,\n  parseSettlementPreviewDraft,\n  type SettlementPreviewDraft,\n} from "~/utils/settlement-preview-draft";\n''',
)
replace_once(
    "app/components/game-settings-fields.tsx",
    '''  onParticipantCountChange?: (value: string) => void;\n  showCoreSettings?: boolean;\n  values: GameSettingsValues;\n}\n''',
    '''  onParticipantCountChange?: (value: string) => void;\n  settlementDraftBaseValues?: GameSettingsValues;\n  settlementDraftStorageKey?: string;\n  showCoreSettings?: boolean;\n  values: GameSettingsValues;\n}\n''',
)
replace_once(
    "app/components/game-settings-fields.tsx",
    '''  onParticipantCountChange,\n  showCoreSettings = true,\n  values,\n}: GameSettingsFieldsProps) {\n''',
    '''  onParticipantCountChange,\n  settlementDraftBaseValues,\n  settlementDraftStorageKey,\n  showCoreSettings = true,\n  values,\n}: GameSettingsFieldsProps) {\n''',
)
replace_once(
    "app/components/game-settings-fields.tsx",
    '''  const [recommendationNotice, setRecommendationNotice] = useState<\n    string | null\n  >(null);\n\n  const analysis = useMemo(\n''',
    '''  const [recommendationNotice, setRecommendationNotice] = useState<\n    string | null\n  >(null);\n  const [draftReady, setDraftReady] = useState(!settlementDraftStorageKey);\n  const [draftSaved, setDraftSaved] = useState(false);\n\n  const analysis = useMemo(\n''',
)
replace_once(
    "app/components/game-settings-fields.tsx",
    '''  useEffect(() => {\n    onValidityChange?.(analysis.isValid);\n  }, [analysis.isValid, onValidityChange]);\n\n  const recommendationAvailable = useMemo(() => {\n''',
    '''  useEffect(() => {\n    onValidityChange?.(analysis.isValid);\n  }, [analysis.isValid, onValidityChange]);\n\n  useEffect(() => {\n    if (!settlementDraftStorageKey) {\n      setDraftReady(true);\n      setDraftSaved(false);\n      return;\n    }\n\n    setDraftReady(false);\n    try {\n      const raw = window.localStorage.getItem(settlementDraftStorageKey);\n      const draft = parseSettlementPreviewDraft(raw);\n      if (!draft) {\n        if (raw) window.localStorage.removeItem(settlementDraftStorageKey);\n        setDraftSaved(false);\n        return;\n      }\n      setVenueCost(draft.venueCost);\n      setParticipantCountInput(draft.participantCount);\n      onParticipantCountChange?.(draft.participantCount);\n      setShareValues([...draft.shareValues]);\n      setRecommendationMode(draft.recommendationMode);\n      setAdjustmentMode(draft.adjustmentMode);\n      setEditingRank(null);\n      setRecommendationNotice(null);\n      setDraftSaved(true);\n    } catch {\n      setDraftSaved(false);\n    } finally {\n      setDraftReady(true);\n    }\n  }, [settlementDraftStorageKey]);\n\n  useEffect(() => {\n    if (!settlementDraftStorageKey || !draftReady) return;\n\n    const draft: SettlementPreviewDraft = {\n      version: 1,\n      venueCost,\n      participantCount: participantCountInput,\n      shareValues: [...shareValues],\n      recommendationMode,\n      adjustmentMode,\n    };\n    const baseValues = settlementDraftBaseValues ?? values;\n    const baseline: SettlementPreviewDraft = {\n      version: 1,\n      venueCost: baseValues.venueCost,\n      participantCount: normalizeParticipantCount(baseValues.previewParticipantCount),\n      shareValues: buildInitialShares(baseValues),\n      recommendationMode: "standard",\n      adjustmentMode: "top-three",\n    };\n\n    try {\n      if (hasSameSettlementPreviewValues(draft, baseline)) {\n        window.localStorage.removeItem(settlementDraftStorageKey);\n        setDraftSaved(false);\n        return;\n      }\n      window.localStorage.setItem(settlementDraftStorageKey, JSON.stringify(draft));\n      setDraftSaved(true);\n    } catch {\n      setDraftSaved(false);\n    }\n  }, [\n    adjustmentMode,\n    draftReady,\n    participantCountInput,\n    recommendationMode,\n    settlementDraftBaseValues,\n    settlementDraftStorageKey,\n    shareValues,\n    values,\n    venueCost,\n  ]);\n\n  const recommendationAvailable = useMemo(() => {\n''',
)
replace_once(
    "app/components/game-settings-fields.tsx",
    '''  function updateShare(index: number, value: string) {\n    setRecommendationNotice(null);\n    setShareValues((current) => {\n      const next = current.map((share, shareIndex) =>\n        shareIndex === index ? value : share,\n      );\n      if (adjustmentMode !== "top-three" || index >= 3) {\n        return next;\n      }\n      try {\n        return calculateCostShares({\n          venueCost: parsePreviewInteger(venueCost),\n          participantCount: parseParticipantCount(participantCountInput),\n          firstPlaceCost: parsePreviewInteger(next[0] ?? ""),\n          secondPlaceCost: parsePreviewInteger(next[1] ?? ""),\n          thirdPlaceCost: parsePreviewInteger(next[2] ?? ""),\n        }).shares.map(String);\n      } catch {\n        return next;\n      }\n    });\n  }\n\n  return (\n''',
    '''  function updateShare(index: number, value: string) {\n    setRecommendationNotice(null);\n    setShareValues((current) => {\n      const next = current.map((share, shareIndex) =>\n        shareIndex === index ? value : share,\n      );\n      if (adjustmentMode !== "top-three" || index >= 3) {\n        return next;\n      }\n      try {\n        return calculateCostShares({\n          venueCost: parsePreviewInteger(venueCost),\n          participantCount: parseParticipantCount(participantCountInput),\n          firstPlaceCost: parsePreviewInteger(next[0] ?? ""),\n          secondPlaceCost: parsePreviewInteger(next[1] ?? ""),\n          thirdPlaceCost: parsePreviewInteger(next[2] ?? ""),\n        }).shares.map(String);\n      } catch {\n        return next;\n      }\n    });\n  }\n\n  function resetSettlementDraft() {\n    const baseValues = settlementDraftBaseValues ?? values;\n    const participantCount = normalizeParticipantCount(\n      baseValues.previewParticipantCount,\n    );\n    setVenueCost(baseValues.venueCost);\n    setParticipantCountInput(participantCount);\n    onParticipantCountChange?.(participantCount);\n    setShareValues(buildInitialShares(baseValues));\n    setRecommendationMode("standard");\n    setAdjustmentMode("top-three");\n    setEditingRank(null);\n    setRecommendationNotice(null);\n    if (settlementDraftStorageKey) {\n      try {\n        window.localStorage.removeItem(settlementDraftStorageKey);\n      } catch {\n        // The in-memory reset still succeeds even when browser storage is blocked.\n      }\n    }\n    setDraftSaved(false);\n  }\n\n  return (\n''',
)
replace_once(
    "app/components/game-settings-fields.tsx",
    '''          <div className="cost-preview-heading">\n            <div>\n              <h2>精算プレビュー</h2>\n            </div>\n            <Field\n''',
    '''          <div className="cost-preview-heading">\n            <div>\n              <h2>精算プレビュー</h2>\n              {settlementDraftStorageKey && draftSaved ? (\n                <div className="settlement-draft-indicator">\n                  <span role="status">● 下書き保存済み</span>\n                  <button\n                    className="text-button"\n                    onClick={resetSettlementDraft}\n                    type="button"\n                  >\n                    元の設定に戻す\n                  </button>\n                </div>\n              ) : null}\n            </div>\n            <Field\n''',
)
replace_once(
    "app/components/game-settings-fields.tsx",
    '''function buildInitialShares(values: GameSettingsValues): string[] {\n  let participantCount: number;\n  try {\n    participantCount = parseParticipantCount(values.previewParticipantCount);\n  } catch {\n    participantCount = 4;\n  }\n''',
    '''function normalizeParticipantCount(value: string): string {\n  try {\n    return String(parseParticipantCount(value));\n  } catch {\n    return "4";\n  }\n}\n\nfunction buildInitialShares(values: GameSettingsValues): string[] {\n  let participantCount: number;\n  try {\n    participantCount = parseParticipantCount(values.previewParticipantCount);\n  } catch {\n    participantCount = 4;\n  }\n''',
)

# Admin route wires draft storage only into the settlement/finalization editor.
replace_once(
    "app/routes/game-admin.tsx",
    '''import { GameSettingsFields } from "../components/game-settings-fields";\n''',
    '''import { GameSettingsFields } from "../components/game-settings-fields";\nimport { buildSettlementPreviewDraftStorageKey } from "~/utils/settlement-preview-draft";\n''',
)
replace_once(
    "app/routes/game-admin.tsx",
    '''  const actionErrors = settingsAction?.errors ?? {};\n  const values = failedAction?.values ?? gameToFormValues(loaderData.game);\n  const [settlementParticipantCount, setSettlementParticipantCount] = useState(\n''',
    '''  const actionErrors = settingsAction?.errors ?? {};\n  const settlementDraftBaseValues = gameToFormValues(loaderData.game);\n  const values = failedAction?.values ?? settlementDraftBaseValues;\n  const settlementDraftStorageKey = buildSettlementPreviewDraftStorageKey(\n    loaderData.group.publicCode,\n    loaderData.game.id,\n  );\n  const [settlementParticipantCount, setSettlementParticipantCount] = useState(\n''',
)
replace_once(
    "app/routes/game-admin.tsx",
    '''          <GameSettingsFields\n            actualParticipantCount={loaderData.participants.length}\n            errors={actionErrors}\n            onParticipantCountChange={setSettlementParticipantCount}\n            showCoreSettings={false}\n            values={values}\n          />\n''',
    '''          <GameSettingsFields\n            actualParticipantCount={loaderData.participants.length}\n            errors={actionErrors}\n            onParticipantCountChange={setSettlementParticipantCount}\n            settlementDraftBaseValues={settlementDraftBaseValues}\n            settlementDraftStorageKey={settlementDraftStorageKey}\n            showCoreSettings={false}\n            values={values}\n          />\n''',
)
replace_once(
    "app/routes/game-admin.tsx",
    '''    return redirect(`/g/${params.groupCode}/manage?notice=game-deleted`, {\n''',
    '''    return redirect(\n      `/g/${params.groupCode}/manage?notice=game-deleted&deletedGameId=${params.gameId}`,\n      {\n''',
)
replace_once(
    "app/routes/game-admin.tsx",
    '''      status: 303,\n      headers: {\n        "Set-Cookie": clearParticipantCookie(\n          request,\n          params.groupCode,\n          params.gameId,\n        ),\n      },\n    });\n''',
    '''        status: 303,\n        headers: {\n          "Set-Cookie": clearParticipantCookie(\n            request,\n            params.groupCode,\n            params.gameId,\n          ),\n        },\n      },\n    );\n''',
)

# Clear successful-finalization draft on the result page.
replace_once(
    "app/routes/game-participant.tsx",
    '''import { OrganizerCostShareCollection } from "~/components/organizer-cost-share-collection";\n''',
    '''import { OrganizerCostShareCollection } from "~/components/organizer-cost-share-collection";\nimport { buildSettlementPreviewDraftStorageKey } from "~/utils/settlement-preview-draft";\n''',
)
replace_once(
    "app/routes/game-participant.tsx",
    '''  useEffect(() => {\n    if (!noticeMessage) {\n      setShowNoticeToast(false);\n      return;\n    }\n''',
    '''  useEffect(() => {\n    if (loaderData.notice !== "finalized") return;\n    try {\n      window.localStorage.removeItem(\n        buildSettlementPreviewDraftStorageKey(\n          loaderData.group.publicCode,\n          loaderData.game.id,\n        ),\n      );\n    } catch {\n      // Finalization already succeeded; blocked local storage must not affect results.\n    }\n  }, [\n    loaderData.game.id,\n    loaderData.group.publicCode,\n    loaderData.notice,\n  ]);\n\n  useEffect(() => {\n    if (!noticeMessage) {\n      setShowNoticeToast(false);\n      return;\n    }\n''',
)

# Clear successful deletion draft after redirecting to organizer home.
replace_once(
    "app/routes/group-manage.tsx",
    '''import { Link } from "react-router";\n''',
    '''import { useEffect } from "react";\nimport { Link } from "react-router";\n''',
)
replace_once(
    "app/routes/group-manage.tsx",
    '''import type { Route } from "./+types/group-manage";\n''',
    '''import type { Route } from "./+types/group-manage";\nimport { buildSettlementPreviewDraftStorageKey } from "~/utils/settlement-preview-draft";\n''',
)
replace_once(
    "app/routes/group-manage.tsx",
    '''  return {\n    ...overview,\n    notice: new URL(request.url).searchParams.get("notice"),\n  };\n''',
    '''  const url = new URL(request.url);\n  return {\n    ...overview,\n    notice: url.searchParams.get("notice"),\n    deletedGameId: url.searchParams.get("deletedGameId"),\n  };\n''',
)
replace_once(
    "app/routes/group-manage.tsx",
    '''  const activeGames = games.filter((game) => game.status !== "finalized");\n  const pastGames = games.filter((game) => game.status === "finalized");\n\n  return (\n''',
    '''  const activeGames = games.filter((game) => game.status !== "finalized");\n  const pastGames = games.filter((game) => game.status === "finalized");\n\n  useEffect(() => {\n    if (loaderData.notice !== "game-deleted" || !loaderData.deletedGameId) {\n      return;\n    }\n    try {\n      window.localStorage.removeItem(\n        buildSettlementPreviewDraftStorageKey(\n          group.publicCode,\n          loaderData.deletedGameId,\n        ),\n      );\n    } catch {\n      // Deletion already succeeded; blocked local storage needs no recovery.\n    }\n    const url = new URL(window.location.href);\n    url.searchParams.delete("deletedGameId");\n    window.history.replaceState(\n      window.history.state,\n      "",\n      `${url.pathname}${url.search}${url.hash}`,\n    );\n  }, [\n    group.publicCode,\n    loaderData.deletedGameId,\n    loaderData.notice,\n  ]);\n\n  return (\n''',
)

# Light UI styling.
app_css = Path("app/styles/app.css")
app_css.write_text(
    app_css.read_text()
    + '''\n\n/* Settlement preview local draft */\n.settlement-draft-indicator {\n  display: flex;\n  align-items: center;\n  flex-wrap: wrap;\n  gap: 8px;\n  margin-top: 6px;\n}\n\n.settlement-draft-indicator > span {\n  color: var(--muted);\n  font-size: 0.7rem;\n  font-weight: 750;\n}\n\n.settlement-draft-indicator .text-button {\n  font-size: 0.7rem;\n}\n'''
)

# Requirements and architecture.
replace_once(
    "docs/requirements.md",
    '''8. 確定値を game_results に保存する\n9. gameを finalized にする\n\n### 3.5 グループTOPで開催を探す\n''',
    '''8. 確定値を game_results に保存する\n9. gameを finalized にする\n10. 主催者画面で確定前に編集した会費・想定人数・順位別負担額は、開催ごと・端末ごとの精算プレビュー下書きとしてブラウザのlocalStorageへ自動保存し、同じ端末で管理画面を開き直したときに復元する。下書きは正式なgame設定や実績・ランキングへ影響しない\n11. 精算プレビューには下書き保存済み表示と「元の設定に戻す」を用意し、正式設定へ戻した場合、結果確定成功時、または受付中開催の削除成功時にその開催の下書きを削除する。別端末には同期しない\n\n### 3.5 グループTOPで開催を探す\n''',
)
replace_once(
    "docs/architecture.md",
    '''## 確定後の結果訂正\n''',
    '''## 精算プレビューのローカル下書き\n\n確定前の精算プレビューは正式な`games`更新とは分離し、主催者のブラウザ`localStorage`だけへ保存する。保存キーはgroup codeとgame IDを含むバージョン付きキーとし、会費、想定人数、順位別負担額、おすすめ配分モード、調整モードをJSONで保持する。`GameSettingsFields`は下書き用propsが渡された開催管理画面だけで復元・自動保存を有効にし、新規開催画面では利用しない。壊れたJSONや未知のversion/modeは無視して削除する。\n\n正式な開催設定と金額・人数・配分が同じ状態では下書きを保持せず、「元の設定に戻す」でlocalStorageを削除して正式値へ戻す。finalize成功後は結果画面への`notice=finalized`遷移時に、受付中開催の削除成功後は管理ホームへのredirectで渡す削除game IDを使って該当キーを削除する。localStorageが利用できない場合でも確定・削除などサーバー処理は失敗させない。\n\n## 確定後の結果訂正\n''',
)

print("Settlement preview draft patch applied")
