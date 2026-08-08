import { describe, expect, it } from "vitest";
import { calculateCostShares } from "./calculate-cost-shares";

describe("calculateCostShares", () => {
  it("精算シートと同じ8人の傾斜配分を返す", () => {
    const result = calculateCostShares({
      venueCost: 5_665,
      participantCount: 8,
      firstPlaceCost: 0,
      secondPlaceCost: 0,
      thirdPlaceCost: 300,
    });

    expect(result).toEqual({
      settlementTotal: 5_700,
      shares: [0, 0, 300, 500, 800, 1_000, 1_300, 1_800],
    });
  });

  it("4位以下を3位以上の負担額にし、順位順に単調増加させる", () => {
    const result = calculateCostShares({
      venueCost: 11_400,
      participantCount: 8,
      firstPlaceCost: 0,
      secondPlaceCost: 500,
      thirdPlaceCost: 1_000,
    });

    expect(result.settlementTotal).toBe(11_400);
    expect(result.shares).toEqual([
      0, 500, 1_000, 1_300, 1_600, 1_900, 2_300, 2_800,
    ]);
    expect(
      result.shares.every(
        (share, index) => index === 0 || share >= result.shares[index - 1]!,
      ),
    ).toBe(true);
    expect(result.shares.reduce((sum, share) => sum + share, 0)).toBe(11_400);
  });

  it("丸め差額を最下位へ寄せて合計を一致させる", () => {
    const result = calculateCostShares({
      venueCost: 10_001,
      participantCount: 6,
      firstPlaceCost: 0,
      secondPlaceCost: 1_000,
      thirdPlaceCost: 2_000,
    });

    expect(result.settlementTotal).toBe(10_100);
    expect(result.shares.reduce((sum, share) => sum + share, 0)).toBe(10_100);
    expect(result.shares.every((share) => share % 100 === 0)).toBe(true);
  });

  it("4〜16人の各ケースで下位の負担額が上位を下回らない", () => {
    for (
      let participantCount = 4;
      participantCount <= 16;
      participantCount += 1
    ) {
      for (const venueCost of [5_665, 11_400, 24_999]) {
        const result = calculateCostShares({
          venueCost,
          participantCount,
          firstPlaceCost: 0,
          secondPlaceCost: 0,
          thirdPlaceCost: 100,
        });

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

  it("1〜3位の負担額が順位順でない設定を拒否する", () => {
    expect(() =>
      calculateCostShares({
        venueCost: 10_000,
        participantCount: 6,
        firstPlaceCost: 0,
        secondPlaceCost: 1_000,
        thirdPlaceCost: 500,
      }),
    ).toThrow(RangeError);
  });

  it("3位額を4位以下へ保証できない設定を拒否する", () => {
    expect(() =>
      calculateCostShares({
        venueCost: 3_000,
        participantCount: 8,
        firstPlaceCost: 0,
        secondPlaceCost: 500,
        thirdPlaceCost: 1_000,
      }),
    ).toThrow(RangeError);
  });

  it("100円単位でない固定額を拒否する", () => {
    expect(() =>
      calculateCostShares({
        venueCost: 10_000,
        participantCount: 6,
        firstPlaceCost: 0,
        secondPlaceCost: 550,
        thirdPlaceCost: 1_000,
      }),
    ).toThrow(RangeError);
  });

  it("4人未満を拒否する", () => {
    expect(() =>
      calculateCostShares({
        venueCost: 4_600,
        participantCount: 3,
        firstPlaceCost: 0,
        secondPlaceCost: 500,
        thirdPlaceCost: 1_000,
      }),
    ).toThrow(RangeError);
  });
});
