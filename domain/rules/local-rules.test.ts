import { describe, expect, it } from "vitest";
import { buildLocalRules } from "./local-rules";

describe("buildLocalRules", () => {
  it("返済ルールは常に有効で72oだけ開催設定を反映する", () => {
    expect(buildLocalRules(false).map((rule) => rule.enabled)).toEqual([
      true,
      false,
    ]);
    expect(buildLocalRules(true)[1]).toMatchObject({
      enabled: true,
      key: "seven-deuce-bonus",
      title: "72oボーナス",
    });
  });
});
