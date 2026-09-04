import { readFileSync } from "node:fs";
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

  it("プレイヤー状態を左線ではなくチップと面で表現する", () => {
    const appCss = readFileSync("app/styles/app.css", "utf8");
    const participantCss = readFileSync("app/styles/participant-status.css", "utf8");

    expect(appCss).not.toContain("border-left: 3px solid #71847a");
    expect(appCss).not.toContain("border-left-color: var(--gold)");
    expect(appCss).toContain(".participant-input-status::before");
    expect(participantCss).not.toContain("box-shadow: inset 2px 0 0");
  });

  it("ユーザー向け呼称をテーブルイベントに統一する", () => {
    const source = readFileSync("app/components/table-event-recorder.tsx", "utf8");
    expect(source).toContain("テーブルイベント");
    expect(source).not.toContain("卓イベント");
  });
});
