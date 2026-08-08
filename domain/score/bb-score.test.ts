import { describe, expect, it } from "vitest";
import {
  calculateBbScore,
  calculateChipsPerBb,
  calculateNetBb,
  formatBbScore,
  formatChipsPerBb,
} from "./bb-score";

describe("BB score", () => {
  it("現在の点数を初期100BB基準へ換算する", () => {
    expect(calculateBbScore({ score: 20_000, initialChips: 20_000 })).toBe(
      100,
    );
    expect(calculateBbScore({ score: -180_000, initialChips: 20_000 })).toBe(
      -900,
    );
  });

  it("小数のBBを最大小数第2位で表示する", () => {
    expect(formatBbScore({ score: 20_100, initialChips: 20_000 })).toBe(
      "+100.5BB",
    );
    expect(formatBbScore({ score: 10_000, initialChips: 30_000 })).toBe(
      "+33.33BB",
    );

  });
  it("正のBBだけプラス記号を付ける", () => {
    expect(formatBbScore({ score: 20_000, initialChips: 20_000 })).toBe(
      "+100BB",
    );
    expect(formatBbScore({ score: 0, initialChips: 20_000 })).toBe("0BB");
    expect(formatBbScore({ score: -20_000, initialChips: 20_000 })).toBe(
      "-100BB",
    );
  });

  it("1BBあたりのチップ量を計算・表示する", () => {
    expect(calculateChipsPerBb(20_000)).toBe(200);
    expect(formatChipsPerBb(20_000)).toBe("200");
  });

  it("将来の戦績用に初期100BBを引いた損益を計算する", () => {
    expect(calculateNetBb({ score: 20_000, initialChips: 20_000 })).toBe(0);
    expect(calculateNetBb({ score: -180_000, initialChips: 20_000 })).toBe(
      -1_000,
    );
  });

  it("初期チップ0は拒否する", () => {
    expect(() =>
      calculateBbScore({ score: 0, initialChips: 0 }),
    ).toThrow(RangeError);
  });
});
