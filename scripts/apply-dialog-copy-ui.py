from pathlib import Path
import subprocess

# RiverCheck のユーザー向け呼称を「テーブルイベント」に統一する。
result = subprocess.run(
    ["git", "grep", "-Il", "卓イベント", "--", "*.ts", "*.tsx", "*.md", "*.css"],
    check=False,
    capture_output=True,
    text=True,
)
paths = [Path(line) for line in result.stdout.splitlines() if line.strip()]
if not paths:
    raise RuntimeError("卓イベント表記が見つかりませんでした")

for path in paths:
    text = path.read_text()
    path.write_text(text.replace("卓イベント", "テーブルイベント"))

css_path = Path("app/styles/participant-status.css")
css = css_path.read_text()
marker = "/* Centered participant/reference dialogs */"
if marker in css:
    raise RuntimeError("dialog presentation override already exists")

css += r'''

/* Centered participant/reference dialogs */
.participant-roster-dialog {
  margin: auto;
  border-bottom: 1px solid rgba(57, 222, 141, 0.28);
  border-radius: 22px;
}

/* Keep the destructive leave action away from the primary table-event control. */
.participant-leave-trigger {
  justify-self: start;
  margin-top: 16px;
  padding-inline: 0;
  opacity: 0.62;
}

.participant-leave-trigger:hover,
.participant-leave-trigger:focus-visible {
  opacity: 1;
}
'''
css_path.write_text(css)

test_path = Path("app/routes/game-participant-dialog-presentation.test.ts")
test_path.write_text(r'''import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("participant dialog presentation", () => {
  it("参加者一覧とローカルルールを中央モーダルで表示する", () => {
    const css = readFileSync("app/styles/participant-status.css", "utf8");
    expect(css).toContain(".participant-roster-dialog {");
    expect(css).toContain("margin: auto;");
    expect(css).toContain("border-radius: 22px;");
  });

  it("参加取消を左寄せの控えめな操作にする", () => {
    const css = readFileSync("app/styles/participant-status.css", "utf8");
    expect(css).toContain(".participant-leave-trigger {");
    expect(css).toContain("justify-self: start;");
    expect(css).toContain("opacity: 0.62;");
  });

  it("ユーザー向け呼称をテーブルイベントに統一する", () => {
    const source = readFileSync("app/components/table-event-recorder.tsx", "utf8");
    expect(source).toContain("テーブルイベント");
    expect(source).not.toContain("卓イベント");
  });
});
''')

remaining = subprocess.run(
    ["git", "grep", "-n", "卓イベント", "--", "*.ts", "*.tsx", "*.md", "*.css"],
    check=False,
    capture_output=True,
    text=True,
)
if remaining.stdout.strip():
    raise RuntimeError(f"卓イベント表記が残っています:\n{remaining.stdout}")
