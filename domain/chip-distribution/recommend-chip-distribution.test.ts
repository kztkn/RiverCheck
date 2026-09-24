import { describe, expect, it } from "vitest";
import { recommendChipDistribution } from "./recommend-chip-distribution";

describe("recommendChipDistribution", () => {
  const goldenDenominations = [10_000, 5_000, 1_000, 500, 100, 50];

  it("実績のある25枚構成を一般化した評価から推奨する", () => {
    const result = recommendChipDistribution(goldenDenominations);
    expect(result).toEqual({
      ok: true,
      recommendation: expect.objectContaining({
        initialChips: 20_000,
        initialStackBb: 100,
        smallBlindChips: 100,
        bigBlindChips: 200,
        bigBlindAnteChips: 200,
        allocations: [
          { denomination: 100, count: 10 },
          { denomination: 500, count: 8 },
          { denomination: 1_000, count: 5 },
          { denomination: 5_000, count: 2 },
        ],
        totalChipCount: 25,
        unusedDenominations: [50, 10_000],
      }),
    });
  });

  it("入力順によらず同じ推奨を返す", () => {
    expect(
      recommendChipDistribution([...goldenDenominations].reverse()),
    ).toEqual(recommendChipDistribution(goldenDenominations));
  });

  it("計算機のBBAは常にBBと同額にする", () => {
    const result = recommendChipDistribution([100, 500, 1_000, 5_000]);
    expect(result.ok && result.recommendation.bigBlindAnteChips).toBe(
      result.ok ? result.recommendation.bigBlindChips : undefined,
    );
  });

  it.each([
    [[100, 100, 500], "duplicate-denomination"],
    [[0, 100, 500], "invalid-denomination"],
    [[-1, 100, 500], "invalid-denomination"],
    [[1.5, 100, 500], "invalid-denomination"],
    [[Number.NaN, 100, 500], "invalid-denomination"],
  ] as const)("不正な額面 %# を拒否する", (denominations, code) => {
    expect(recommendChipDistribution([...denominations])).toMatchObject({
      ok: false,
      code,
    });
  });

  it("実用的な3〜4額面・20〜30枚のexact sumがなければ明示エラーにする", () => {
    expect(recommendChipDistribution([100, 10_000, 50_000])).toMatchObject({
      ok: false,
      code: "no-practical-configuration",
      error: expect.stringContaining("小さい額面"),
    });
  });
});
