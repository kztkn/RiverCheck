import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("settlement plan publication UX", () => {
  it("publishes a validated settlement plan from the admin screen", () => {
    const source = readFileSync("app/routes/game-admin.tsx", "utf8");
    expect(source).toContain('value="publish-settlement-plan"');
    expect(source).toContain("publishSettlementPlan");
    expect(source).toContain("参加者に公開");
    expect(source).toContain("公開内容を更新");
  });

  it("shows published settlement plans to participants", () => {
    const source = readFileSync("app/routes/game-participant.tsx", "utf8");
    expect(source).toContain("SettlementPlanSheet");
    expect(source).toContain("今日の精算予定");
    expect(source).toContain("settlementPlanPublishedAt");
  });
});


it("seated participants also see the published plan", () => {
  const source = readFileSync("app/routes/game-participant.tsx", "utf8");
  expect((source.match(/<SettlementPlanSheet/g) ?? []).length).toBeGreaterThanOrEqual(2);
});
