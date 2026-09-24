import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const playersSource = readFileSync("app/routes/players.tsx", "utf8");
const appCss = readFileSync("app/styles/app.css", "utf8");

describe("member permission mobile layout", () => {
  it("権限入力を専用スイッチにして共通input幅で本文を圧迫しない", () => {
    expect(playersSource).toContain('className="member-permission-copy"');
    expect(playersSource).toContain('className="member-permission-switch"');
    expect(appCss).toMatch(
      /\.member-permission-toggle\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) 46px;/su,
    );
    expect(appCss).toMatch(
      /\.member-permission-toggle input\s*\{[^}]*width:\s*1px;[^}]*min-width:\s*0;/su,
    );
  });

  it("スマホでは権限保存ボタンを利用可能幅いっぱいにする", () => {
    expect(appCss).toMatch(
      /@media \(max-width: 520px\)[\s\S]*?\.member-permission-form > \.button\s*\{[^}]*width:\s*100%;[^}]*justify-self:\s*stretch;/u,
    );
  });
});
