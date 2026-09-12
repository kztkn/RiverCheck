import { describe, expect, it } from "vitest";
import { calculateFinalResults } from "./calculate-final-results";

const settings = {
  initialChips: 20_000,
  rebuyChips: 20_000,
  venueCost: 10_000,
  firstPlaceCost: 1_000,
  secondPlaceCost: 2_000,
  thirdPlaceCost: 3_000,
};

describe("calculateFinalResults", () => {
  it("検算、点数、順位、負担額を同じ参加者へ割り当てる", () => {
    const calculated = calculateFinalResults(settings, [
      {
        groupPlayerId: "a",
        displayName: "A",
        remainingChips: 30_000,
        totalRebuyCount: 0,
        outstandingRebuyCount: 0,
        settlementRebuyCount: 0,
      },
      {
        groupPlayerId: "b",
        displayName: "B",
        remainingChips: 20_000,
        totalRebuyCount: 0,
        outstandingRebuyCount: 0,
        settlementRebuyCount: 0,
      },
      {
        groupPlayerId: "c",
        displayName: "C",
        remainingChips: 15_000,
        totalRebuyCount: 0,
        outstandingRebuyCount: 0,
        settlementRebuyCount: 0,
      },
      {
        groupPlayerId: "d",
        displayName: "D",
        remainingChips: 15_000,
        totalRebuyCount: 1,
        outstandingRebuyCount: 1,
        settlementRebuyCount: 1,
      },
    ]);

    expect(calculated.chipValidation.isValid).toBe(true);
    expect(calculated.results.map((result) => result.groupPlayerId)).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
    expect(calculated.results.map((result) => result.rank)).toEqual([1, 2, 3, 4]);
    expect(calculated.results.map((result) => result.costShare)).toEqual([
      1_000, 2_000, 3_000, 4_000,
    ]);
  });

  it("保存済みの全順位配分を順位へそのまま割り当てる", () => {
    const calculated = calculateFinalResults(
      {
        ...settings,
        costShares: [1_000, 2_000, 3_000, 4_000],
      },
      [
        {
          groupPlayerId: "a",
          displayName: "A",
          remainingChips: 40_000,
          totalRebuyCount: 0,
          outstandingRebuyCount: 0,
          settlementRebuyCount: 0,
        },
        {
          groupPlayerId: "b",
          displayName: "B",
          remainingChips: 30_000,
          totalRebuyCount: 0,
          outstandingRebuyCount: 0,
          settlementRebuyCount: 0,
        },
        {
          groupPlayerId: "c",
          displayName: "C",
          remainingChips: 20_000,
          totalRebuyCount: 0,
          outstandingRebuyCount: 0,
          settlementRebuyCount: 0,
        },
        {
          groupPlayerId: "d",
          displayName: "D",
          remainingChips: 10_000,
          totalRebuyCount: 0,
          outstandingRebuyCount: 0,
          settlementRebuyCount: 0,
        },
      ],
    );

    expect(calculated.results.map((result) => result.costShare)).toEqual([
      1_000, 2_000, 3_000, 4_000,
    ]);
  });

  it("2人未満は確定計算できない", () => {
    expect(() =>
      calculateFinalResults(settings, [
        {
          groupPlayerId: "a",
          displayName: "A",
          remainingChips: 20_000,
          totalRebuyCount: 0,
          outstandingRebuyCount: 0,
          settlementRebuyCount: 0,
        },
      ]),
    ).toThrow("participantCount must be at least 2");
  });
});