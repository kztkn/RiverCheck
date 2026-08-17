import { describe, expect, it } from "vitest";
import { calculatePodiumCostShares } from "./calculate-podium-cost-shares";

describe("calculatePodiumCostShares", () => {
  it("12,000円を8人の表彰台ボーナス配分にする", () => {
    expect(calculatePodiumCostShares(12_000, 8)).toEqual({
      settlementTotal: 12_000,
      shares: [0, 700, 1_100, 1_800, 2_000, 2_100, 2_100, 2_200],
    });
  });

  it("6人でも最下位を均等割の1.6倍以内に収める", () => {
    expect(calculatePodiumCostShares(12_000, 6)).toEqual({
      settlementTotal: 12_000,
      shares: [0, 1_200, 1_800, 2_800, 3_000, 3_200],
    });
  });

  it("6〜20人の各ケースで保存可能な配分を返す", () => {
    for (
      let participantCount = 6;
      participantCount <= 20;
      participantCount += 1
    ) {
      for (const venueCost of [0, 1, 250, 5_665, 12_000, 24_999]) {
        const result = calculatePodiumCostShares(
          venueCost,
          participantCount,
        );

        expect(result.shares).toHaveLength(participantCount);
        expect(result.shares[0]).toBe(0);
        expect(result.shares.every((share) => share >= 0)).toBe(true);
        expect(result.shares.every((share) => share % 100 === 0)).toBe(true);
        expect(
          result.shares.every(
            (share, index) =>
              index === 0 || share >= result.shares[index - 1]!,
          ),
        ).toBe(true);
        expect(result.shares.reduce((sum, share) => sum + share, 0)).toBe(
          result.settlementTotal,
        );
      }
    }
  });

  it("6人未満を拒否する", () => {
    expect(() => calculatePodiumCostShares(12_000, 5)).toThrow(RangeError);
  });
});
