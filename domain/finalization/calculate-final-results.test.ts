import { describe, expect, it } from "vitest";
import { calculateFinalResults } from "./calculate-final-results";

const settings = {
  initialChips: 20_000,
  rebuyChips: 10_000,
  venueCost: 10_000,
  firstPlaceCost: 0,
  secondPlaceCost: 500,
  thirdPlaceCost: 1_000,
};

describe("calculateFinalResults", () => {
  it("検算、点数、順位、負担額を同じ参加者へ割り当てる", () => {
    const calculated = calculateFinalResults(settings, [
      {
        groupPlayerId: "d",
        displayName: "D",
        remainingChips: 10_000,
        rebuyCount: 0,
      },
      {
        groupPlayerId: "a",
        displayName: "A",
        remainingChips: 50_000,
        rebuyCount: 1,
      },
      {
        groupPlayerId: "c",
        displayName: "C",
        remainingChips: 15_000,
        rebuyCount: 0,
      },
      {
        groupPlayerId: "b",
        displayName: "B",
        remainingChips: 15_000,
        rebuyCount: 0,
      },
    ]);

    expect(calculated.chipValidation).toMatchObject({
      expectedTotal: 90_000,
      reportedTotal: 90_000,
      difference: 0,
      isValid: true,
    });
    expect(
      calculated.results.map(({ displayName, score, rank, costShare }) => ({
        displayName,
        score,
        rank,
        costShare,
      })),
    ).toEqual([
      { displayName: "A", score: 40_000, rank: 1, costShare: 0 },
      { displayName: "B", score: 15_000, rank: 2, costShare: 500 },
      { displayName: "C", score: 15_000, rank: 3, costShare: 1_000 },
      { displayName: "D", score: 10_000, rank: 4, costShare: 8_500 },
    ]);
  });

  it("4人未満は確定計算できない", () => {
    expect(() =>
      calculateFinalResults(settings, [
        {
          groupPlayerId: "a",
          displayName: "A",
          remainingChips: 20_000,
          rebuyCount: 0,
        },
      ]),
    ).toThrow("participantCount must be at least 4");
  });
});
