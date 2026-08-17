import { describe, expect, it } from "vitest";
import { calculateSimpleCostShares } from "./calculate-simple-cost-shares";

describe("calculateSimpleCostShares", () => {
  it("8人分を切り上げて超過分だけ1位を安くする", () => {
    expect(calculateSimpleCostShares(11_330, 8)).toEqual({
      settlementTotal: 11_400,
      shares: [900, 1_500, 1_500, 1_500, 1_500, 1_500, 1_500, 1_500],
    });
  });

  it("均等額が100円単位で割り切れる場合は全員を同額にする", () => {
    expect(calculateSimpleCostShares(12_000, 6)).toEqual({
      settlementTotal: 12_000,
      shares: [2_000, 2_000, 2_000, 2_000, 2_000, 2_000],
    });
  });

  it("会費が小さくても上位を0円にしてマイナスを返さない", () => {
    expect(calculateSimpleCostShares(250, 4)).toEqual({
      settlementTotal: 300,
      shares: [0, 100, 100, 100],
    });
  });

  it("会費0円では全員を0円にする", () => {
    expect(calculateSimpleCostShares(0, 4)).toEqual({
      settlementTotal: 0,
      shares: [0, 0, 0, 0],
    });
  });

  it("4〜20人の各ケースで保存可能な配分を返す", () => {
    for (
      let participantCount = 4;
      participantCount <= 20;
      participantCount += 1
    ) {
      for (const venueCost of [0, 1, 250, 5_665, 11_330, 24_999]) {
        const result = calculateSimpleCostShares(venueCost, participantCount);

        expect(result.shares).toHaveLength(participantCount);
        expect(result.shares.every((share) => share >= 0)).toBe(true);
        expect(result.shares.every((share) => share % 100 === 0)).toBe(true);
        expect(
          result.shares.every(
            (share, index) => index === 0 || share >= result.shares[index - 1]!,
          ),
        ).toBe(true);
        expect(result.shares.reduce((sum, share) => sum + share, 0)).toBe(
          result.settlementTotal,
        );
      }
    }
  });

  it("4人未満を拒否する", () => {
    expect(() => calculateSimpleCostShares(11_330, 3)).toThrow(RangeError);
  });
});
