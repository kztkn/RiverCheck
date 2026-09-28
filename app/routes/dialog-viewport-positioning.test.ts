import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appCss = readFileSync("app/styles/app.css", "utf8");
const participantSource = readFileSync(
  "app/routes/game-participant.tsx",
  "utf8",
);

describe("dialog viewport positioning", () => {
  it("app dialogをスクロール位置ではなくviewportへ固定する", () => {
    const rule = appCss.match(/\.app-dialog\s*\{(?<body>[^}]*)\}/u)?.groups?.body;

    expect(rule).toContain("position: fixed;");
    expect(rule).toContain("inset: 0;");
    expect(rule).toContain("margin: auto;");
  });

  it("今日のまとめをbody直下へportalし、表示中は背面スクロールを止める", () => {
    const settlementPlanSource = participantSource.slice(
      participantSource.indexOf("export function SettlementPlanSheet"),
      participantSource.indexOf("export function shouldShowLocalRules"),
    );

    expect(settlementPlanSource).toContain("<BodyPortal>");
    expect(settlementPlanSource).toContain('document.body.style.overflow = "hidden"');
    expect(settlementPlanSource).toContain(
      'className="app-dialog participant-roster-dialog rebuy-rules-dialog"',
    );
  });
});
