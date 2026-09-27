import type {
  YearRecapAchievement,
  YearRecapPlayerHighlight,
  YearRecapResultSource,
  YearRecapStreak,
  YearRecapStoryStats,
  YearRecapSummary,
} from "../../types/year-recap";

interface BuildYearRecapInput {
  year: number;
  groupPlayerId: string;
  displayName: string;
  avatarUpdatedAt: string | null;
  results: YearRecapResultSource[];
  stories: YearRecapStoryStats;
  achievements: YearRecapAchievement[];
}

export function buildYearRecap(input: BuildYearRecapInput): YearRecapSummary {
  const chronologicalGameIds = listChronologicalGameIds(input.results);
  const players = aggregatePlayers(input.results);
  const personalResults = input.results
    .filter((result) => result.groupPlayerId === input.groupPlayerId)
    .sort(compareResults);
  const personalPlayer = players.get(input.groupPlayerId);
  const metPlayers = findMetPlayers(input.results, personalResults, input.groupPlayerId);
  const podiumMates = findPodiumMates(input.results, personalResults, input.groupPlayerId);

  return {
    year: input.year,
    group: {
      gamesPlayed: chronologicalGameIds.length,
      totalEntries: input.results.length,
      uniquePlayers: players.size,
      totalRebuys: input.results.reduce(
        (total, result) => total + result.totalRebuyCount,
        0,
      ),
      mostWinsPlayers: selectMostWinsPlayers(players),
    },
    player: {
      groupPlayerId: input.groupPlayerId,
      displayName: input.displayName,
      avatarUpdatedAt: input.avatarUpdatedAt,
      gamesPlayed: personalResults.length,
      attendanceRate:
        chronologicalGameIds.length === 0
          ? 0
          : personalResults.length / chronologicalGameIds.length * 100,
      wins: personalPlayer?.wins ?? 0,
      topThreeFinishes: personalResults.filter((result) => result.rank <= 3)
        .length,
      totalNetBb: personalResults.reduce(
        (total, result) => total + result.netBb,
        0,
      ),
      totalRebuys: personalResults.reduce(
        (total, result) => total + result.totalRebuyCount,
        0,
      ),
      bestGame: personalResults
        .filter((result) => result.netBb > 0)
        .reduce<YearRecapSummary["player"]["bestGame"]>(
          (best, result) =>
            !best || result.netBb > best.netBb
              ? {
                  gameId: result.gameId,
                  gameTitle: result.gameTitle,
                  playedAt: result.playedAt,
                  rank: result.rank,
                  netBb: result.netBb,
                }
              : best,
          null,
        ),
      metPlayers,
      podiumMates,
      longestStreak: findLongestStreak(personalResults, chronologicalGameIds),
    },
    stories: input.stories,
    achievements: [...input.achievements].sort((left, right) =>
      left.unlockedAt.localeCompare(right.unlockedAt),
    ),
  };
}

interface PlayerAggregate {
  groupPlayerId: string;
  displayName: string;
  avatarUpdatedAt: string | null;
  wins: number;
}

function aggregatePlayers(results: YearRecapResultSource[]) {
  const players = new Map<string, PlayerAggregate>();
  for (const result of results) {
    const player = players.get(result.groupPlayerId) ?? {
      groupPlayerId: result.groupPlayerId,
      displayName: result.displayName,
      avatarUpdatedAt: result.avatarUpdatedAt,
      wins: 0,
    };
    if (result.rank === 1) player.wins += 1;
    players.set(result.groupPlayerId, player);
  }
  return players;
}

function selectMostWinsPlayers(
  players: Map<string, PlayerAggregate>,
): YearRecapPlayerHighlight[] {
  const maximum = Math.max(0, ...[...players.values()].map((player) => player.wins));
  if (maximum === 0) return [];
  return [...players.values()]
    .filter((player) => player.wins === maximum)
    .sort((left, right) =>
      left.displayName.localeCompare(right.displayName, "ja") ||
      left.groupPlayerId.localeCompare(right.groupPlayerId),
    )
    .map((player) => ({
      groupPlayerId: player.groupPlayerId,
      displayName: player.displayName,
      avatarUpdatedAt: player.avatarUpdatedAt,
      value: player.wins,
    }));
}

function findMetPlayers(
  results: YearRecapResultSource[],
  personalResults: YearRecapResultSource[],
  groupPlayerId: string,
): YearRecapPlayerHighlight[] {
  const personalGameIds = new Set(personalResults.map((result) => result.gameId));
  const counts = new Map<string, YearRecapPlayerHighlight & { firstMetAt: string }>();
  for (const result of [...results].sort(compareResults)) {
    if (
      result.groupPlayerId === groupPlayerId ||
      !personalGameIds.has(result.gameId)
    ) {
      continue;
    }
    const current = counts.get(result.groupPlayerId);
    counts.set(result.groupPlayerId, {
      groupPlayerId: result.groupPlayerId,
      displayName: result.displayName,
      avatarUpdatedAt: result.avatarUpdatedAt,
      value: (current?.value ?? 0) + 1,
      firstMetAt: current?.firstMetAt ?? result.playedAt,
    });
  }
  return [...counts.values()]
    .sort((left, right) =>
      left.firstMetAt.localeCompare(right.firstMetAt) ||
      left.displayName.localeCompare(right.displayName, "ja") ||
      left.groupPlayerId.localeCompare(right.groupPlayerId),
    )
    .map(({ firstMetAt: _firstMetAt, ...player }) => player);
}

function findPodiumMates(
  results: YearRecapResultSource[],
  personalResults: YearRecapResultSource[],
  groupPlayerId: string,
): YearRecapPlayerHighlight[] {
  const personalPodiumGameIds = new Set(
    personalResults.filter((result) => result.rank <= 3).map((result) => result.gameId),
  );
  const counts = new Map<string, YearRecapPlayerHighlight>();
  for (const result of results) {
    if (
      result.groupPlayerId === groupPlayerId ||
      result.rank > 3 ||
      !personalPodiumGameIds.has(result.gameId)
    ) {
      continue;
    }
    const current = counts.get(result.groupPlayerId);
    counts.set(result.groupPlayerId, {
      groupPlayerId: result.groupPlayerId,
      displayName: result.displayName,
      avatarUpdatedAt: result.avatarUpdatedAt,
      value: (current?.value ?? 0) + 1,
    });
  }
  const maximum = Math.max(0, ...[...counts.values()].map((player) => player.value));
  return [...counts.values()]
    .filter((player) => player.value === maximum)
    .sort((left, right) =>
      left.displayName.localeCompare(right.displayName, "ja") ||
      left.groupPlayerId.localeCompare(right.groupPlayerId),
    );
}

function findLongestStreak(
  personalResults: YearRecapResultSource[],
  chronologicalGameIds: string[],
): YearRecapStreak | null {
  const personalGameIds = new Set(personalResults.map((result) => result.gameId));
  const candidates: Array<YearRecapStreak & { priority: number }> = [
    {
      kind: "positive",
      count: findLongestRun(personalResults.map((result) => result.netBb > 0)),
      priority: 0,
    },
    {
      kind: "top-three",
      count: findLongestRun(personalResults.map((result) => result.rank <= 3)),
      priority: 1,
    },
    {
      kind: "attendance",
      count: findLongestRun(chronologicalGameIds.map((gameId) => personalGameIds.has(gameId))),
      priority: 2,
    },
  ];
  const longest = candidates.sort(
    (left, right) => right.count - left.count || left.priority - right.priority,
  )[0];
  return longest && longest.count >= 2
    ? { kind: longest.kind, count: longest.count }
    : null;
}

function findLongestRun(values: boolean[]) {
  let longest = 0;
  let current = 0;
  for (const value of values) {
    current = value ? current + 1 : 0;
    longest = Math.max(longest, current);
  }
  return longest;
}

function listChronologicalGameIds(results: YearRecapResultSource[]) {
  return [...new Map(
    [...results].sort(compareResults).map((result) => [result.gameId, result.gameId]),
  ).values()];
}

function compareResults(
  left: YearRecapResultSource,
  right: YearRecapResultSource,
) {
  return left.playedAt.localeCompare(right.playedAt) ||
    left.gameId.localeCompare(right.gameId);
}

export function getTokyoYearRange(year: number): {
  startAt: string;
  endAt: string;
} {
  return {
    startAt: new Date(Date.UTC(year - 1, 11, 31, 15)).toISOString(),
    endAt: new Date(Date.UTC(year, 11, 31, 15)).toISOString(),
  };
}
