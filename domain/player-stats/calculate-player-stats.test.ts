import { describe, expect, it } from "vitest";
import {
  addCumulativeNetBb,
  calculatePlayerStats,
} from "./calculate-player-stats";

describe("calculatePlayerStats", () => {
  it("参加0回はすべて0を返す", () => {
    expect(calculatePlayerStats([])).toEqual({
      gamesPlayed: 0,
      wins: 0,
      topThreeFinishes: 0,
      topThreeRate: 0,
      positiveFinishes: 0,
      positiveRate: 0,
      totalNetBb: 0,
      averageNetBb: 0,
      maxWinBb: 0,
      maxLossBb: 0,
    });
  });

  it("1回だけの戦績を集計する", () => {
    expect(
      calculatePlayerStats([{ gameId: "game-1", rank: 1, netBb: 25 }]),
    ).toEqual({
      gamesPlayed: 1,
      wins: 1,
      topThreeFinishes: 1,
      topThreeRate: 100,
      positiveFinishes: 1,
      positiveRate: 100,
      totalNetBb: 25,
      averageNetBb: 25,
      maxWinBb: 25,
      maxLossBb: 0,
    });
  });

  it("複数開催のTOP3率、プラス収支率、損益を集計する", () => {
    expect(
      calculatePlayerStats([
        { gameId: "game-1", rank: 1, netBb: 60 },
        { gameId: "game-2", rank: 4, netBb: -30 },
        { gameId: "game-3", rank: 2, netBb: 15 },
      ]),
    ).toEqual({
      gamesPlayed: 3,
      wins: 1,
      topThreeFinishes: 2,
      topThreeRate: 200 / 3,
      positiveFinishes: 2,
      positiveRate: 200 / 3,
      totalNetBb: 45,
      averageNetBb: 15,
      maxWinBb: 60,
      maxLossBb: -30,
    });
  });

  it("0BBはプラス収支へ含めない", () => {
    expect(
      calculatePlayerStats([
        { gameId: "game-1", rank: 3, netBb: 0 },
        { gameId: "game-2", rank: 4, netBb: -10 },
      ]),
    ).toMatchObject({
      positiveFinishes: 0,
      positiveRate: 0,
      topThreeFinishes: 1,
      topThreeRate: 50,
    });
  });

  it("現在の確定結果だけを渡せば訂正履歴は二重集計されない", () => {
    const currentResults = [{ gameId: "game-1", rank: 2, netBb: 10 }];
    expect(calculatePlayerStats(currentResults).gamesPlayed).toBe(1);
  });
});

describe("addCumulativeNetBb", () => {
  it("時系列順の損益を累積する", () => {
    expect(
      addCumulativeNetBb([
        { gameId: "game-1", rank: 3, netBb: -20 },
        { gameId: "game-2", rank: 1, netBb: 50 },
        { gameId: "game-3", rank: 2, netBb: 10 },
      ]).map((game) => game.cumulativeNetBb),
    ).toEqual([-20, 30, 40]);
  });
});
