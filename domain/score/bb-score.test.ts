import { describe, expect, it } from "vitest";
import {
  calculateInitialStackBb,
  calculateChipsPerBb,
  calculateNetBb,
  formatChipsPerBb,
  formatNetBb,
  formatSignedBbValue,
} from "./bb-score";

describe("BB score", () => {
  it("1BBあたりのチップ量を計算・表示する", () => {
    expect(calculateChipsPerBb(20_000)).toBe(200);
    expect(formatChipsPerBb(20_000)).toBe("200");
  });

  it("初期100BBを引いた損益を計算する", () => {
    expect(calculateNetBb({ score: 20_000, initialChips: 20_000 })).toBe(0);
    expect(calculateNetBb({ score: -180_000, initialChips: 20_000 })).toBe(
      -1_000,
    );
  });

  it("実際のBBから開始スタックBBを算出する", () => {
    expect(calculateInitialStackBb(20_000, 200)).toBe(100);
    expect(calculateInitialStackBb(500, 20)).toBe(25);
    expect(() => calculateInitialStackBb(500, 30)).toThrow(RangeError);
  });

  it("50BB開始では同じチップ差分を50BB基準で換算する", () => {
    expect(calculateChipsPerBb(20_000, 50)).toBe(400);
    expect(
      formatNetBb({
        score: 40_000,
        initialChips: 20_000,
        initialStackBb: 50,
      }),
    ).toBe("+50BB");
    expect(
      formatNetBb({
        score: 0,
        initialChips: 20_000,
        initialStackBb: 50,
      }),
    ).toBe("-50BB");
  });

  it("損益BBを初期スタック0BB基準で表示する", () => {
    expect(formatNetBb({ score: 40_000, initialChips: 20_000 })).toBe(
      "+100BB",
    );
    expect(formatNetBb({ score: 20_000, initialChips: 20_000 })).toBe("0BB");
    expect(formatNetBb({ score: 10_000, initialChips: 20_000 })).toBe("-50BB");
    expect(formatNetBb({ score: 0, initialChips: 20_000 })).toBe("-100BB");
  });

  it("戦績の正負と小数を読みやすく表示する", () => {
    expect(formatSignedBbValue(12.345)).toBe("+12.35BB");
    expect(formatSignedBbValue(0)).toBe("0BB");
    expect(formatSignedBbValue(-7.5)).toBe("-7.5BB");
  });

  it("初期チップ0は拒否する", () => {
    expect(() =>
      calculateNetBb({ score: 0, initialChips: 0 }),
    ).toThrow(RangeError);
  });
});
