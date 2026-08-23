import { describe, expect, it } from "vitest";
import { buildLocalRules } from "./local-rules";

describe("buildLocalRules", () => {
  it("返済ルールは常に有効で開催設定を72oとボムポットへ反映する", () => {
    expect(buildLocalRules(false, false).map((rule) => rule.enabled)).toEqual([
      true,
      false,
      false,
    ]);
    expect(buildLocalRules(true, true)[1]).toMatchObject({
      enabled: true,
      key: "seven-deuce-bonus",
      title: "72oボーナス",
    });
    expect(buildLocalRules(true, true)[2]).toMatchObject({
      enabled: true,
      key: "bomb-pot",
      title: "ボムポット",
    });
    expect(buildLocalRules(true, true)[2]?.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: expect.stringContaining("2.5BB") }),
        expect.objectContaining({ text: expect.stringContaining("フロップ") }),
      ]),
    );
  });
});
