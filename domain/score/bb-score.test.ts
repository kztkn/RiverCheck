import { describe, expect, it } from "vitest";
import {
  calculateChipsPerBb,
  calculateNetBb,
  formatChipsPerBb,
  formatNetBb,
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

  it("損益BBを初期スタック0BB基準で表示する", () => {
    expect(formatNetBb({ score: 40_000, initialChips: 20_000 })).toBe(
      "+100BB",
    );
    expect(formatNetBb({ score: 20_000, initialChips: 20_000 })).toBe("0BB");
    expect(formatNetBb({ score: 10_000, initialChips: 20_000 })).toBe("-50BB");
    expect(formatNetBb({ score: 0, initialChips: 20_000 })).toBe("-100BB");
  });

  it("初期チップ0は拒否する", () => {
    expect(() =>
      calculateNetBb({ score: 0, initialChips: 0 }),
    ).toThrow(RangeError);
  });
});
