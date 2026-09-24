import { describe, expect, it } from "vitest";
import { calculateFinalResults } from "./calculate-final-results";

const settings = {
  initialChips: 20_000,
  bigBlindChips: 200,
  rebuyChips: 10_000,
  venueCost: 10_000,
  firstPlaceCost: 0,
  secondPlaceCost: 500,
  thirdPlaceCost: 1_000,
  bbRate: 0,
};

describe("calculateFinalResults", () => {
  it("検算、点数、順位、負担額を同じ参加者へ割り当てる", () => {
    const calculated = calculateFinalResults(settings, [
      {
        groupPlayerId: "d",
        displayName: "D",
        remainingChips: 10_000,
        totalRebuyCount: 0,
        outstandingRebuyCount: 0,
        settlementRebuyCount: 0,
      },
      {
        groupPlayerId: "a",
        displayName: "A",
        remainingChips: 50_000,
        totalRebuyCount: 2,
        outstandingRebuyCount: 1,
        settlementRebuyCount: 1,
      },
      {
        groupPlayerId: "c",
        displayName: "C",
        remainingChips: 15_000,
        totalRebuyCount: 1,
        outstandingRebuyCount: 0,
        settlementRebuyCount: 0,
      },
      {
        groupPlayerId: "b",
        displayName: "B",
        remainingChips: 15_000,
        totalRebuyCount: 2,
        outstandingRebuyCount: 0,
        settlementRebuyCount: 0,
      },
    ]);

    expect(calculated.results[0]).toMatchObject({
      displayName: "A",
      totalRebuyCount: 2,
      settlementRebuyCount: 1,
      score: 40_000,
    });
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
      { displayName: "C", score: 15_000, rank: 2, costShare: 500 },
      { displayName: "B", score: 15_000, rank: 3, costShare: 1_000 },
      { displayName: "D", score: 10_000, rank: 4, costShare: 8_500 },
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

  it("BB収支を100円単位かつゼロサムのゲーム精算額へ変換する", () => {
    const calculated = calculateFinalResults(
      {
        ...settings,
        bbRate: 5,
        venueCost: 12_000,
        costShares: [500, 900, 1_200, 1_400, 1_600, 1_800, 2_100, 2_500],
      },
      [80_000, 60_000, 40_000, 30_000, 10_000, 0, -20_000, -40_000].map(
        (score, index) => ({
          groupPlayerId: `player-${index + 1}`,
          displayName: `P${index + 1}`,
          remainingChips: Math.max(0, score),
          totalRebuyCount: score < 0 ? Math.abs(score) / 10_000 : 0,
          outstandingRebuyCount: score < 0 ? Math.abs(score) / 10_000 : 0,
          settlementRebuyCount: score < 0 ? Math.abs(score) / 10_000 : 0,
        }),
      ),
    );

    expect(
      calculated.results.map((result) => result.gameSettlementAmount),
    ).toEqual([1_500, 1_000, 500, 300, -300, -500, -1_000, -1_500]);
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

  it("2人開催を確定計算できる", () => {
    const calculated = calculateFinalResults(
      { ...settings, venueCost: 3_000, costShares: [1_000, 2_000] },
      [
        {
          groupPlayerId: "a",
          displayName: "A",
          remainingChips: 25_000,
          totalRebuyCount: 0,
          outstandingRebuyCount: 0,
          settlementRebuyCount: 0,
        },
        {
          groupPlayerId: "b",
          displayName: "B",
          remainingChips: 15_000,
          totalRebuyCount: 0,
          outstandingRebuyCount: 0,
          settlementRebuyCount: 0,
        },
      ],
    );

    expect(
      calculated.results.map(({ displayName, rank, costShare }) => ({
        displayName,
        rank,
        costShare,
      })),
    ).toEqual([
      { displayName: "A", rank: 1, costShare: 1_000 },
      { displayName: "B", rank: 2, costShare: 2_000 },
    ]);
  });
});
