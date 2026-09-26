import { describe, expect, it } from "vitest";
import {
  serializeGameChipDistribution,
  validateGameChipDistribution,
} from "./game-chip-distribution";

describe("game chip distribution", () => {
  const standard = [
    { denomination: 5_000, count: 2 },
    { denomination: 1_000, count: 5 },
    { denomination: 500, count: 8 },
    { denomination: 100, count: 10 },
  ];

  it("初期チップと一致する構成を額面順へ正規化する", () => {
    expect(validateGameChipDistribution(standard, 20_000)).toEqual({
      ok: true,
      value: [
        { denomination: 100, count: 10 },
        { denomination: 500, count: 8 },
        { denomination: 1_000, count: 5 },
        { denomination: 5_000, count: 2 },
      ],
    });
  });

  it("合計が初期チップと一致しない構成を拒否する", () => {
    expect(validateGameChipDistribution(standard, 10_000)).toMatchObject({
      ok: false,
      error: expect.stringContaining("初期チップ"),
    });
  });

  it("空・重複・不正枚数を拒否する", () => {
    expect(validateGameChipDistribution([], 20_000).ok).toBe(false);
    expect(
      validateGameChipDistribution(
        [
          { denomination: 100, count: 10 },
          { denomination: 100, count: 190 },
        ],
        20_000,
      ).ok,
    ).toBe(false);
    expect(
      validateGameChipDistribution(
        [{ denomination: 20_000, count: 0 }],
        20_000,
      ).ok,
    ).toBe(false);
  });

  it("保存用JSONへ変換する", () => {
    expect(serializeGameChipDistribution(standard)).toBe(JSON.stringify(standard));
    expect(serializeGameChipDistribution(null)).toBe("");
  });
});
