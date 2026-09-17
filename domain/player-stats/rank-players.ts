import type {
  PlayerRankingMetrics,
  PlayerStatsSort,
} from "./ranking-types";

export const PLAYER_STATS_SORTS = [
  "total", "average", "recent", "top-three", "rank-rate", "max-win", "max-loss",
] as const satisfies readonly PlayerStatsSort[];

export function rankPlayers<T extends PlayerRankingMetrics>(
  ranking: readonly T[],
  sort: PlayerStatsSort,
): Array<T & { rank: number }> {
  const sorted = [...ranking].sort((left, right) => {
    const metricOrder = compareRankingMetrics(left, right, sort);
    return metricOrder !== 0
      ? metricOrder
      : left.displayName.localeCompare(right.displayName, "ja") ||
        left.groupPlayerId.localeCompare(right.groupPlayerId);
  });

  let previousRank = 0;
  return sorted.map((player, index) => {
    const previous = sorted[index - 1];
    const rank = previous && compareRankingMetrics(previous, player, sort) === 0
      ? previousRank
      : index + 1;
    previousRank = rank;
    return { ...player, rank };
  });
}

export function calculatePlayerStatsRanking<T extends PlayerRankingMetrics>(
  snapshots: { current: readonly T[]; previous: readonly T[] },
  sort: PlayerStatsSort,
): Array<T & { rank: number; previousRanks: Record<PlayerStatsSort, number | null> }> {
  const previousRanks = new Map<string, Record<PlayerStatsSort, number | null>>();
  for (const metric of PLAYER_STATS_SORTS) {
    for (const player of rankPlayers(snapshots.previous, metric)) {
      const ranks = previousRanks.get(player.groupPlayerId) ?? emptyPreviousRanks();
      ranks[metric] = player.rank;
      previousRanks.set(player.groupPlayerId, ranks);
    }
  }
  return rankPlayers(snapshots.current, sort).map((player) => ({
    ...player,
    previousRanks: previousRanks.get(player.groupPlayerId) ?? emptyPreviousRanks(),
  }));
}

function emptyPreviousRanks(): Record<PlayerStatsSort, number | null> {
  return {
    total: null,
    average: null,
    recent: null,
    "top-three": null,
    "rank-rate": null,
    "max-win": null,
    "max-loss": null,
  };
}

function compareRankingMetrics(
  left: PlayerRankingMetrics,
  right: PlayerRankingMetrics,
  sort: PlayerStatsSort,
): number {
  if (sort === "average") {
    return compareDesc(left.averageNetBb, right.averageNetBb) ||
      compareDesc(left.totalNetBb, right.totalNetBb);
  }
  if (sort === "max-win") {
    return compareDesc(left.maxWinBb, right.maxWinBb) ||
      compareDesc(left.totalNetBb, right.totalNetBb);
  }
  if (sort === "max-loss") {
    return compareAsc(left.maxLossBb, right.maxLossBb) ||
      compareDesc(left.totalNetBb, right.totalNetBb);
  }
  if (sort === "recent") {
    return compareDesc(left.recentAverageNetBb, right.recentAverageNetBb) ||
      compareDesc(left.totalNetBb, right.totalNetBb);
  }
  if (sort === "top-three") {
    return compareDesc(left.topThreeFinishes, right.topThreeFinishes) ||
      compareDesc(left.wins, right.wins) ||
      compareDesc(left.totalNetBb, right.totalNetBb);
  }
  if (sort === "rank-rate") {
    return compareNullableAsc(left.averageRankRate, right.averageRankRate) ||
      compareDesc(left.totalNetBb, right.totalNetBb);
  }
  return compareDesc(left.totalNetBb, right.totalNetBb) ||
    compareDesc(left.averageNetBb, right.averageNetBb);
}

function compareDesc(left: number, right: number): number {
  return right - left;
}

function compareAsc(left: number, right: number): number {
  return left - right;
}

function compareNullableAsc(left: number | null, right: number | null): number {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left - right;
}
