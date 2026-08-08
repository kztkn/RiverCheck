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
      winRate: 0,
      averageRank: 0,
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
      winRate: 100,
      averageRank: 1,
      totalNetBb: 25,
      averageNetBb: 25,
      maxWinBb: 25,
      maxLossBb: 0,
    });
  });

  it("複数開催のプラス・マイナス、平均、優勝率を集計する", () => {
    expect(
      calculatePlayerStats([
        { gameId: "game-1", rank: 1, netBb: 60 },
        { gameId: "game-2", rank: 4, netBb: -30 },
        { gameId: "game-3", rank: 2, netBb: 15 },
      ]),
    ).toEqual({
      gamesPlayed: 3,
      wins: 1,
      winRate: 100 / 3,
      averageRank: 7 / 3,
      totalNetBb: 45,
      averageNetBb: 15,
      maxWinBb: 60,
      maxLossBb: -30,
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
