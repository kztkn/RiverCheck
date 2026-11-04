import { describe, expect, it } from "vitest";
import { buildLocalRules } from "./local-rules";

describe("buildLocalRules", () => {
  it("返済ルールは常に有効で開催設定を72oとボムポットへ反映する", () => {
    expect(buildLocalRules(false, false).map((rule) => rule.enabled)).toEqual([
      true,
      false,
      false,
      true,
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

  it("STAND UPのON/OFFと目印チップ・支払いのルールを返す", () => {
    expect(buildLocalRules(true, true, 100, false)[3]).toMatchObject({ enabled: false, key: "stand-up", note: "この開催では適用しません。" });
    const rule = buildLocalRules(true, true, 100, true)[3]!;
    expect(rule.enabled).toBe(true);
    expect(rule.note).toBeNull();
    expect(rule.steps).toEqual([
      { label: "開始時", text: "参加者全員が目印チップを受け取ります" },
      { label: "ポット獲得", text: "ポットを獲得した人から目印チップを返します" },
      { label: "最後の1人", text: "目印チップが最後まで残った人は、ほかの参加者全員へ2.5BBずつ渡します" },
    ]);
  });

  it("50BB開始では返済単位も50BBとして案内する", () => {
    expect(buildLocalRules(true, true, 50)[0]).toMatchObject({
      title: "50BB返済ルール",
      steps: expect.arrayContaining([
        { label: "150BB超", text: "任意で50BBを返済できます" },
      ]),
    });
  });
});
