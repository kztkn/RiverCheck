import { describe, expect, it } from "vitest";
import { calculatePlayerStatsRanking, PLAYER_STATS_SORTS, rankPlayers } from "./rank-players";
import type { PlayerRankingMetrics, PlayerStatsSort } from "./ranking-types";

function player(id: string, values: Partial<PlayerRankingMetrics> = {}): PlayerRankingMetrics {
  return {
    groupPlayerId: id, displayName: id, gamesPlayed: 4, wins: 0,
    topThreeFinishes: 2, totalNetBb: 0, averageNetBb: 0,
    maxWinBb: 10, maxLossBb: -10, recentAverageNetBb: 0,
    recentGameCount: 3, averageRankRate: 50,
    ...values,
  };
}

describe("rankPlayers", () => {
  const cases: Array<[PlayerStatsSort, Partial<PlayerRankingMetrics>, Partial<PlayerRankingMetrics>]> = [
    ["total", { totalNetBb: 100 }, { totalNetBb: -20 }],
    ["average", { averageNetBb: 10 }, { averageNetBb: -2 }],
    ["recent", { recentAverageNetBb: 40 }, { recentAverageNetBb: 20 }],
    ["top-three", { topThreeFinishes: 4 }, { topThreeFinishes: 2 }],
    ["rank-rate", { averageRankRate: 25 }, { averageRankRate: 50 }],
    ["max-win", { maxWinBb: 120 }, { maxWinBb: 40 }],
    ["max-loss", { maxLossBb: -200 }, { maxLossBb: -50 }],
  ];
  it.each(cases)("orders %s without mutating the input", (sort, first, second) => {
    const input = [player("B", second), player("A", first)];
    expect(rankPlayers(input, sort).map((row) => [row.groupPlayerId, row.rank]))
      .toEqual([["A", 1], ["B", 2]]);
    expect(input.map((row) => row.groupPlayerId)).toEqual(["B", "A"]);
    expect(input[0]).not.toHaveProperty("rank");
  });

  it.each(PLAYER_STATS_SORTS)("keeps competition ranks for %s", (sort) => {
    const tied = [player("B"), player("A"), player("C", {
      totalNetBb: -10, averageNetBb: -10, recentAverageNetBb: -10,
      topThreeFinishes: 1, maxWinBb: 0, maxLossBb: 0, averageRankRate: 75,
    })];
    expect(rankPlayers(tied, sort).map((row) => [row.groupPlayerId, row.rank]))
      .toEqual([["A", 1], ["B", 1], ["C", 3]]);
  });

  it("uses average as the total-profit tie-break", () => {
    expect(rankPlayers([
      player("A", { totalNetBb: 100, averageNetBb: 10 }),
      player("B", { totalNetBb: 100, averageNetBb: 20 }),
    ], "total").map((row) => row.groupPlayerId)).toEqual(["B", "A"]);
  });

  it.each(["average", "recent", "max-win", "max-loss", "rank-rate"] as const)(
    "uses total profit as the %s tie-break", (sort) => {
      expect(rankPlayers([player("A"), player("B", { totalNetBb: 10 })], sort)
        .map((row) => row.groupPlayerId)).toEqual(["B", "A"]);
    },
  );

  it("uses wins then total profit to break TOP3 ties", () => {
    expect(rankPlayers([
      player("A", { wins: 1, totalNetBb: 200 }),
      player("B", { wins: 2, totalNetBb: 100 }),
      player("C", { wins: 2, totalNetBb: 300 }),
    ], "top-three").map((row) => row.groupPlayerId)).toEqual(["C", "B", "A"]);
  });

  it("puts unknown rank rates last and ignores names when assigning ties", () => {
    expect(rankPlayers([
      player("C", { totalNetBb: 500, averageRankRate: null }),
      player("B", { displayName: "same" }),
      player("A", { displayName: "same" }),
    ], "rank-rate").map((row) => [row.groupPlayerId, row.rank]))
      .toEqual([["A", 1], ["B", 1], ["C", 3]]);
  });
});

describe("calculatePlayerStatsRanking", () => {
  it("returns all previous ranks, supports switching and includes absent players' changes", () => {
    const ranking = calculatePlayerStatsRanking({
      previous: [player("A", { totalNetBb: 20, averageNetBb: 20 }), player("B", { totalNetBb: 50, averageNetBb: 10 })],
      current: [player("A", { totalNetBb: 100, averageNetBb: 5 }), player("B", { totalNetBb: 50, averageNetBb: 10 })],
    }, "total");
    expect(ranking[0]).toMatchObject({ groupPlayerId: "A", rank: 1, previousRanks: { total: 2, average: 1 } });
    expect(Object.keys(ranking[0].previousRanks).sort()).toEqual([...PLAYER_STATS_SORTS].sort());
    expect(rankPlayers(ranking, "average")[1]).toMatchObject({ groupPlayerId: "A", rank: 2, previousRanks: { average: 1 } });
    expect(ranking[1]).toMatchObject({ groupPlayerId: "B", rank: 2, previousRanks: { total: 1 } });
  });

  it("keeps first-time players without inventing previous ranks", () => {
    const ranking = calculatePlayerStatsRanking({
      current: [player("A"), player("first-time", { totalNetBb: 200 })], previous: [player("A")],
    }, "total");
    expect(ranking[0].groupPlayerId).toBe("first-time");
    expect(Object.values(ranking[0].previousRanks)).toEqual(Array(7).fill(null));
    expect(ranking[1].previousRanks.total).toBe(1);
    expect(ranking[1].rank).toBe(2);
  });

  it("supports zero games and the first finalized game", () => {
    expect(calculatePlayerStatsRanking({ current: [], previous: [] }, "total")).toEqual([]);
    const ranking = calculatePlayerStatsRanking({ current: [player("A")], previous: [] }, "recent");
    expect(Object.values(ranking[0].previousRanks)).toEqual(Array(7).fill(null));
  });

  it("compares tied ranks rather than array positions", () => {
    const ranking = calculatePlayerStatsRanking({
      previous: [player("A"), player("B"), player("C", { totalNetBb: -10 })],
      current: [player("A"), player("B"), player("C", { totalNetBb: 10 })],
    }, "total");
    expect(ranking.map((row) => [row.groupPlayerId, row.rank, row.previousRanks.total]))
      .toEqual([["C", 1, 3], ["A", 2, 1], ["B", 2, 1]]);
  });
});
