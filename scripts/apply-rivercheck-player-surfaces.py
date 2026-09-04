from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"target not found: {path}\n{old[:160]}")
    p.write_text(text.replace(old, new, 1))

# Participant roster: remove the AI-dashboard-ish left rail and keep a soft table-surface cue.
replace_once(
    "app/styles/participant-status.css",
    ".participant-roster-list li.is-current-user {\n  margin-inline: -8px;\n  border-bottom-color: transparent;\n  border-radius: 12px;\n  background: rgba(57, 222, 141, 0.07);\n  box-shadow: inset 2px 0 0 rgba(57, 222, 141, 0.7);\n  padding-inline: 8px;\n}\n",
    ".participant-roster-list li.is-current-user {\n  margin-inline: -8px;\n  border-bottom-color: transparent;\n  border-radius: 12px;\n  background:\n    radial-gradient(circle at 14px 50%, rgba(57, 222, 141, 0.12), transparent 34px),\n    rgba(57, 222, 141, 0.045);\n  padding-inline: 8px;\n}\n",
)

# Admin participant rows: neutral felt surfaces, status communicated by chip marker + tone, never a left rail.
replace_once(
    "app/styles/app.css",
    ".admin-page .participant-admin-row {\n  display: grid;\n  width: 100%;\n  min-width: 0;\n  grid-template-columns: minmax(0, 1fr);\n  justify-content: stretch;\n  gap: 0;\n  overflow: hidden;\n  border: 1px solid rgba(223, 236, 227, 0.14);\n  border-left: 3px solid #71847a;\n  border-radius: 13px;\n  background: rgba(14, 30, 24, 0.82);\n  padding: 0;\n  box-shadow: none;\n}\n\n.admin-page .participant-admin-row.is-input-complete {\n  border-left-color: rgba(57, 222, 141, 0.72);\n}\n\n.admin-page .participant-admin-row.is-input-warning {\n  border-color: rgba(233, 186, 90, 0.25);\n  border-left-color: var(--gold);\n}\n\n.admin-page .participant-admin-row[open] {\n  border-color: rgba(223, 236, 227, 0.22);\n  background: #102119;\n}\n",
    ".admin-page .participant-admin-row {\n  display: grid;\n  width: 100%;\n  min-width: 0;\n  grid-template-columns: minmax(0, 1fr);\n  justify-content: stretch;\n  gap: 0;\n  overflow: hidden;\n  border: 1px solid rgba(223, 236, 227, 0.14);\n  border-radius: 14px;\n  background: rgba(14, 30, 24, 0.76);\n  padding: 0;\n  box-shadow: none;\n}\n\n.admin-page .participant-admin-row.is-input-complete {\n  background:\n    radial-gradient(circle at 92% 12%, rgba(57, 222, 141, 0.055), transparent 150px),\n    rgba(14, 30, 24, 0.78);\n}\n\n.admin-page .participant-admin-row.is-input-warning {\n  border-color: rgba(233, 186, 90, 0.24);\n  background:\n    radial-gradient(circle at 92% 12%, rgba(233, 186, 90, 0.08), transparent 160px),\n    rgba(21, 31, 23, 0.82);\n}\n\n.admin-page .participant-admin-row[open] {\n  border-color: rgba(223, 236, 227, 0.22);\n  background: #102119;\n}\n",
)

replace_once(
    "app/styles/app.css",
    ".admin-page .participant-input-status {\n  border: 1px solid rgba(223, 236, 227, 0.13);\n  border-radius: 999px;\n  color: #aab9b1;\n  font-size: 0.59rem;\n  font-weight: 850;\n  line-height: 1;\n  padding: 5px 7px;\n  white-space: nowrap;\n}\n\n.admin-page .is-input-complete .participant-input-status {\n  border-color: rgba(57, 222, 141, 0.24);\n  background: rgba(57, 222, 141, 0.07);\n  color: #8ed9b3;\n}\n\n.admin-page .is-input-warning .participant-input-status {\n  border-color: rgba(233, 186, 90, 0.3);\n  background: rgba(233, 186, 90, 0.09);\n  color: var(--gold);\n}\n",
    ".admin-page .participant-input-status {\n  display: inline-flex;\n  min-height: 24px;\n  align-items: center;\n  gap: 6px;\n  border: 1px solid rgba(223, 236, 227, 0.12);\n  border-radius: 999px;\n  background: rgba(5, 15, 10, 0.32);\n  color: #aab9b1;\n  font-size: 0.59rem;\n  font-weight: 850;\n  line-height: 1;\n  padding: 4px 8px 4px 6px;\n  white-space: nowrap;\n}\n\n.admin-page .participant-input-status::before {\n  width: 10px;\n  height: 10px;\n  flex: 0 0 10px;\n  border: 1px solid #71847a;\n  border-radius: 50%;\n  box-shadow: inset 0 0 0 2px rgba(113, 132, 122, 0.16);\n  content: \"\";\n}\n\n.admin-page .is-input-complete .participant-input-status {\n  border-color: rgba(57, 222, 141, 0.2);\n  background: rgba(57, 222, 141, 0.055);\n  color: #8ed9b3;\n}\n\n.admin-page .is-input-complete .participant-input-status::before {\n  border-color: var(--green);\n  background: rgba(57, 222, 141, 0.28);\n  box-shadow: inset 0 0 0 2px #102119;\n}\n\n.admin-page .is-input-warning .participant-input-status {\n  border-color: rgba(233, 186, 90, 0.26);\n  background: rgba(233, 186, 90, 0.075);\n  color: var(--gold);\n}\n\n.admin-page .is-input-warning .participant-input-status::before {\n  border-color: var(--gold);\n  background: rgba(233, 186, 90, 0.26);\n  box-shadow: inset 0 0 0 2px #172017;\n}\n",
)

# Keep a regression test close to the presentation rule.
test = Path("app/routes/game-participant-dialog-presentation.test.ts")
text = test.read_text()
anchor = '  it("ユーザー向け呼称をテーブルイベントに統一する", () => {'
insert = '''  it("プレイヤー状態を左線ではなくチップと面で表現する", () => {\n    const appCss = readFileSync("app/styles/app.css", "utf8");\n    const participantCss = readFileSync("app/styles/participant-status.css", "utf8");\n\n    expect(appCss).not.toContain("border-left: 3px solid #71847a");\n    expect(appCss).not.toContain("border-left-color: var(--gold)");\n    expect(appCss).toContain(".participant-input-status::before");\n    expect(participantCss).not.toContain("box-shadow: inset 2px 0 0");\n  });\n\n'''
if insert not in text:
    if anchor not in text:
        raise SystemExit("test anchor not found")
    text = text.replace(anchor, insert + anchor, 1)
    test.write_text(text)

# Document the visual language as an architectural design rule.
doc = Path("docs/architecture.md")
doc_text = doc.read_text()
section = '''\n\n## RiverCheck UI の視覚言語\n\n- RiverCheck はポーカーテーブル上の道具や情報を連想できる、深緑を基調とした落ち着いた卓上UIを優先する。\n- 入力済み、要確認、選択中などの状態を、カード左端の太い色線だけで表現しない。状態はチップ状の小さなマーカー、バッジ、面のトーン、文字の強弱を組み合わせて示す。\n- プレイヤー一覧は一人ずつを過度にカード化せず、名札・ロスターとして読めるフラットな並びを基本とする。囲いは操作単位や展開可能な情報に必要な場合だけ使う。\n- スート記号はポーカーそのものの意味がある場面に限定し、一般的な管理状態の装飾には多用しない。\n- 状態色は原則として RiverCheck green、gold、muted を使い、赤は削除や取消など明確な危険操作に限定する。\n'''
if "## RiverCheck UI の視覚言語" not in doc_text:
    doc.write_text(doc_text.rstrip() + section + "\n")
