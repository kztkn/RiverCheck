from __future__ import annotations

from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


root = Path(".")
route_path = root / "app/routes/game-participant.tsx"
route = route_path.read_text(encoding="utf-8")

route = replace_once(
    route,
    'type RebuyActionIntent = "record-rebuy" | "record-repayment" | "undo-rebuy";\ntype RebuyActionData = RebuyServiceResult & { intent: RebuyActionIntent };\n',
    'type RebuyActionIntent = "record-rebuy" | "record-repayment" | "undo-rebuy";\ntype RebuyActionData = RebuyServiceResult & { intent: RebuyActionIntent };\n\nexport type UndoableRebuyAction = {\n  eventId: string;\n  intent: "record-rebuy" | "record-repayment";\n};\n',
    "rebuy action types",
)

route = replace_once(
    route,
    '''  const isPending = fetcher.state !== "idle";\n  const result = fetcher.data;\n  const submissionPendingRef = useRef(false);\n  const [feedbackVisible, setFeedbackVisible] = useState(false);\n\n  useEffect(() => {\n    if (fetcher.state === "idle") submissionPendingRef.current = false;\n  }, [fetcher.state]);\n\n  useEffect(() => {\n    if (!result?.ok) {\n      setFeedbackVisible(false);\n      return;\n    }\n    setFeedbackVisible(true);\n    const timeoutId = window.setTimeout(\n      () => setFeedbackVisible(false),\n      4_000,\n    );\n    return () => window.clearTimeout(timeoutId);\n  }, [result]);\n\n  const canUndo =\n    result?.ok === true &&\n    result.intent !== "undo-rebuy" &&\n    Boolean(result.eventId);\n''',
    '''  const isPending = fetcher.state !== "idle";\n  const result = fetcher.data;\n  const submissionPendingRef = useRef(false);\n  const [undoableAction, setUndoableAction] =\n    useState<UndoableRebuyAction | null>(null);\n\n  useEffect(() => {\n    if (fetcher.state === "idle") submissionPendingRef.current = false;\n  }, [fetcher.state]);\n\n  useEffect(() => {\n    setUndoableAction((current) =>\n      resolveUndoableRebuyAction(current, result),\n    );\n  }, [result]);\n''',
    "rebuy feedback state",
)

route = replace_once(
    route,
    '''  function undo() {\n    if (!result?.ok || !result.eventId) return;\n    if (submissionPendingRef.current) return;\n    setFeedbackVisible(false);\n    submissionPendingRef.current = true;\n    void fetcher.submit(\n      {\n        commandId: createCommandId(),\n        eventId: result.eventId,\n        intent: "undo-rebuy",\n      },\n      { method: "post" },\n    );\n  }\n\n  const feedbackMessage =\n    result?.ok === true\n      ? result.intent === "record-rebuy"\n        ? "リバイを記録しました。"\n        : result.intent === "record-repayment"\n          ? "100BBの返済を記録しました。"\n          : "直前の操作を元に戻しました。"\n      : null;\n''',
    '''  function undo() {\n    if (!undoableAction) return;\n    if (submissionPendingRef.current) return;\n    submissionPendingRef.current = true;\n    void fetcher.submit(\n      {\n        commandId: createCommandId(),\n        eventId: undoableAction.eventId,\n        intent: "undo-rebuy",\n      },\n      { method: "post" },\n    );\n  }\n\n  const feedbackMessage =\n    undoableAction?.intent === "record-rebuy"\n      ? "直前：＋ リバイ"\n      : undoableAction?.intent === "record-repayment"\n        ? "直前：100BB返済"\n        : null;\n''',
    "rebuy undo handler",
)

route = replace_once(
    route,
    '''      {feedbackMessage && feedbackVisible ? (\n        <div\n          aria-live="polite"\n          className="app-toast rebuy-action-toast"\n          role="status"\n        >\n          <span aria-hidden="true">✓</span>\n          <strong>{feedbackMessage}</strong>\n          {canUndo ? (\n            <button\n              className="rebuy-toast-undo"\n              disabled={isPending}\n              onClick={undo}\n              type="button"\n            >\n              元に戻す\n            </button>\n          ) : null}\n        </div>\n      ) : null}\n''',
    '''      {feedbackMessage ? (\n        <div\n          aria-live="polite"\n          className="rebuy-action-feedback"\n          role="status"\n        >\n          <span className="rebuy-action-feedback-copy">\n            <span aria-hidden="true">✓</span>\n            <strong>{feedbackMessage}</strong>\n          </span>\n          <button\n            className="rebuy-inline-undo"\n            disabled={isPending}\n            onClick={undo}\n            type="button"\n          >\n            <span aria-hidden="true">↶</span>\n            元に戻す\n          </button>\n        </div>\n      ) : null}\n''',
    "rebuy inline feedback markup",
)

helper_marker = '''function ResultEntryForm({\n'''
helper = '''export function resolveUndoableRebuyAction(\n  current: UndoableRebuyAction | null,\n  result: RebuyActionData | undefined,\n): UndoableRebuyAction | null {\n  if (!result?.ok) return current;\n  if (result.intent === "undo-rebuy") return null;\n  if (!result.eventId) return current;\n  return { eventId: result.eventId, intent: result.intent };\n}\n\n'''
if helper.strip() not in route:
    route = replace_once(route, helper_marker, helper + helper_marker, "rebuy undo helper")
route_path.write_text(route, encoding="utf-8")

css_path = root / "app/styles/app.css"
css = css_path.read_text(encoding="utf-8")
css_block = '''\n\n/* Keep the latest rebuy action undoable in context instead of a timed toast. */\n.rebuy-action-feedback {\n  display: flex;\n  min-width: 0;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n  margin-top: 2px;\n  border-top: 1px solid rgba(223, 236, 227, 0.12);\n  padding: 10px 2px 0;\n}\n\n.rebuy-action-feedback-copy {\n  display: inline-flex;\n  min-width: 0;\n  align-items: center;\n  gap: 7px;\n  color: var(--muted);\n}\n\n.rebuy-action-feedback-copy > span {\n  display: grid;\n  width: 18px;\n  height: 18px;\n  flex: 0 0 18px;\n  place-items: center;\n  border-radius: 50%;\n  background: rgba(57, 222, 141, 0.14);\n  color: var(--green);\n  font-size: 0.68rem;\n  font-weight: 900;\n}\n\n.rebuy-action-feedback-copy strong {\n  overflow: hidden;\n  color: #c8d4cd;\n  font-size: 0.74rem;\n  font-weight: 750;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.rebuy-inline-undo {\n  display: inline-flex;\n  min-height: 40px;\n  flex: 0 0 auto;\n  align-items: center;\n  gap: 5px;\n  border: 0;\n  border-radius: 9px;\n  background: transparent;\n  color: var(--ink);\n  cursor: pointer;\n  font-size: 0.76rem;\n  font-weight: 800;\n  padding: 6px 8px;\n}\n\n.rebuy-inline-undo:hover,\n.rebuy-inline-undo:focus-visible {\n  background: rgba(57, 222, 141, 0.08);\n  color: var(--green);\n}\n\n.rebuy-inline-undo:disabled {\n  cursor: wait;\n  opacity: 0.5;\n}\n\n@media (max-width: 360px) {\n  .rebuy-action-feedback {\n    gap: 7px;\n  }\n\n  .rebuy-action-feedback-copy strong {\n    font-size: 0.7rem;\n  }\n\n  .rebuy-inline-undo {\n    padding-inline: 5px;\n    font-size: 0.72rem;\n  }\n}\n'''
if ".rebuy-action-feedback {" not in css:
    css += css_block
css_path.write_text(css, encoding="utf-8")

test_path = root / "app/routes/game-participant.test.ts"
test = test_path.read_text(encoding="utf-8")
test = replace_once(
    test,
    '''  ParticipantRosterSheet,\n  shouldShowLocalRules,\n} from "./game-participant";\n''',
    '''  ParticipantRosterSheet,\n  resolveUndoableRebuyAction,\n  shouldShowLocalRules,\n} from "./game-participant";\n''',
    "test import",
)

undo_tests = '''describe("resolveUndoableRebuyAction", () => {\n  const first = {\n    eventId: "66666666-6666-4666-8666-666666666666",\n    intent: "record-rebuy" as const,\n  };\n\n  it("成功したリバイを時間制限なしの直前操作として保持する", () => {\n    expect(\n      resolveUndoableRebuyAction(null, {\n        ok: true,\n        eventId: first.eventId,\n        intent: "record-rebuy",\n        state: { totalRebuyCount: 1, outstandingRebuyCount: 1 },\n      }),\n    ).toEqual(first);\n  });\n\n  it("次の操作が失敗しても直前の成功操作をUNDO対象として残す", () => {\n    expect(\n      resolveUndoableRebuyAction(first, {\n        ok: false,\n        error: "未返済のリバイはありません。",\n        intent: "record-repayment",\n      }),\n    ).toEqual(first);\n  });\n\n  it("次の成功操作でUNDO対象を置き換え、UNDO成功時に消す", () => {\n    const repayment = resolveUndoableRebuyAction(first, {\n      ok: true,\n      eventId: "77777777-7777-4777-8777-777777777777",\n      intent: "record-repayment",\n      state: { totalRebuyCount: 1, outstandingRebuyCount: 0 },\n    });\n    expect(repayment).toEqual({\n      eventId: "77777777-7777-4777-8777-777777777777",\n      intent: "record-repayment",\n    });\n    expect(\n      resolveUndoableRebuyAction(repayment, {\n        ok: true,\n        eventId: null,\n        intent: "undo-rebuy",\n        state: { totalRebuyCount: 1, outstandingRebuyCount: 1 },\n      }),\n    ).toBeNull();\n  });\n});\n\n'''
marker = 'describe("LocalRulesSheet", () => {\n'
if undo_tests.strip() not in test:
    test = replace_once(test, marker, undo_tests + marker, "undo tests")
test_path.write_text(test, encoding="utf-8")

requirements_path = root / "docs/requirements.md"
requirements = requirements_path.read_text(encoding="utf-8")
requirements = replace_once(
    requirements,
    '12. finalized 後は参加者が編集できず、参加者一覧の入口も表示しない\n',
    '12. finalized 後は参加者が編集できず、参加者一覧の入口も表示しない\n13. リバイ・返済の成功後はリバイ操作欄内に直前の成功操作と「元に戻す」を表示する。時間経過では消さず、次の成功操作で置き換え、UNDO成功またはページ再読込・遷移で消える。失敗した操作では直前のUNDO対象を失わない\n',
    "requirements rebuy undo",
)
requirements_path.write_text(requirements, encoding="utf-8")

architecture_path = root / "docs/architecture.md"
architecture = architecture_path.read_text(encoding="utf-8")
architecture_section = '''## リバイUNDOの操作フィードバック\n\n参加者のリバイ・100BB返済は既存の`useFetcher`による1操作1保存を維持する。成功後のUNDO導線は画面下部の時間制限付きtoastへ置かず、`RebuyTracker`内の操作ボタン直下に「直前の操作」として表示する。成功した直前イベントIDをクライアントstateへ保持し、時間経過では失効させない。次のリバイ・返済が成功した場合だけ新しいイベントへ置き換え、操作失敗時は既存のUNDO対象を保持する。UNDO成功、ページ再読込、ページ遷移でクライアントstateを破棄する。サーバー側の「直前のイベントだけUNDO可能」という既存制約を正とする。\n\n'''
if architecture_section.strip() not in architecture:
    architecture = replace_once(
        architecture,
        '## TABLE STORIESとCloudflare R2\n',
        architecture_section + '## TABLE STORIESとCloudflare R2\n',
        "architecture rebuy undo",
    )
architecture_path.write_text(architecture, encoding="utf-8")
