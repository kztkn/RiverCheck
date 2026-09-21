import { describe, expect, it } from "vitest";
import {
  calculateRoundedGameSettlements,
  calculateSettlementBalance,
} from "./calculate-game-settlements";

describe("calculateRoundedGameSettlements", () => {
  it("8人のBB収支を100円単位かつゼロサムへ調整する", () => {
    const scores = [80_000, 60_000, 40_000, 30_000, 10_000, 0, -20_000, -40_000];
    const results = calculateRoundedGameSettlements(
      scores.map((score, index) => ({
        groupPlayerId: `player-${index + 1}`,
        score,
      })),
      20_000,
      5,
    );

    expect(results.map((result) => result.gameSettlementAmount)).toEqual([
      1_500, 1_000, 500, 300, -300, -500, -1_000, -1_500,
    ]);
    expect(
      results.reduce((total, result) => total + result.gameSettlementAmount, 0),
    ).toBe(0);
  });

  it("ゼロサム調整後の丸め誤差が最小になる配分を選ぶ", () => {
    const results = calculateRoundedGameSettlements(
      [
        { groupPlayerId: "a", score: 20_660 },
        { groupPlayerId: "b", score: 20_660 },
        { groupPlayerId: "c", score: 18_680 },
      ],
      20_000,
      10,
    );

    expect(results.map((result) => result.gameSettlementAmount)).toEqual([0, 0, 0]);
  });

  it("bbRate 0では差分があっても全員0円にする", () => {
    expect(
      calculateRoundedGameSettlements(
        [
          { groupPlayerId: "a", score: 21_000 },
          { groupPlayerId: "b", score: 20_000 },
        ],
        20_000,
        0,
      ).map((result) => result.gameSettlementAmount),
    ).toEqual([0, 0]);
  });

  it("BB精算有効時は非ゼロサムの結果を拒否する", () => {
    expect(() =>
      calculateRoundedGameSettlements(
        [
          { groupPlayerId: "a", score: 21_000 },
          { groupPlayerId: "b", score: 20_000 },
        ],
        20_000,
        5,
      ),
    ).toThrow("zero-sum");
  });

  it("最終残高をゲーム精算額から会費負担額を引いて求める", () => {
    expect(
      calculateSettlementBalance({
        gameSettlementAmount: 1_500,
        costShare: 500,
      }),
    ).toBe(1_000);
    expect(
      calculateSettlementBalance({
        gameSettlementAmount: -1_500,
        costShare: 2_500,
      }),
    ).toBe(-4_000);
  });
});
