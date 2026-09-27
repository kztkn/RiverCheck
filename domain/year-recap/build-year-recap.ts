import type {
  YearRecapAchievement,
  YearRecapResultSource,
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
  const games = new Set(input.results.map((result) => result.gameId));
  const players = aggregatePlayers(input.results);
  const personalResults = input.results
    .filter((result) => result.groupPlayerId === input.groupPlayerId)
    .sort(compareResults);
  const personalPlayer = players.get(input.groupPlayerId);
  const tableMate = findTableMate(
    input.results,
    personalResults,
    input.groupPlayerId,
  );

  return {
    year: input.year,
    group: {
      gamesPlayed: games.size,
      totalEntries: input.results.length,
      uniquePlayers: players.size,
      totalRebuys: input.results.reduce(
        (total, result) => total + result.totalRebuyCount,
        0,
      ),
      mostActivePlayer: selectLeader(players, "gamesPlayed"),
      mostWinsPlayer: selectLeader(players, "wins"),
    },
    player: {
      groupPlayerId: input.groupPlayerId,
      displayName: input.displayName,
      avatarUpdatedAt: input.avatarUpdatedAt,
      gamesPlayed: personalResults.length,
      attendanceRate:
        games.size === 0 ? 0 : personalResults.length / games.size * 100,
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
      tableMate,
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
  gamesPlayed: number;
  wins: number;
}

function aggregatePlayers(results: YearRecapResultSource[]) {
  const players = new Map<string, PlayerAggregate>();
  for (const result of results) {
    const player = players.get(result.groupPlayerId) ?? {
      groupPlayerId: result.groupPlayerId,
      displayName: result.displayName,
      avatarUpdatedAt: result.avatarUpdatedAt,
      gamesPlayed: 0,
      wins: 0,
    };
    player.gamesPlayed += 1;
    if (result.rank === 1) player.wins += 1;
    players.set(result.groupPlayerId, player);
  }
  return players;
}

function selectLeader(
  players: Map<string, PlayerAggregate>,
  metric: "gamesPlayed" | "wins",
): YearRecapSummary["group"]["mostActivePlayer"] {
  const leader = [...players.values()].sort((left, right) =>
    right[metric] - left[metric] ||
    right.gamesPlayed - left.gamesPlayed ||
    left.displayName.localeCompare(right.displayName, "ja"),
  )[0];
  return leader
    ? {
        groupPlayerId: leader.groupPlayerId,
        displayName: leader.displayName,
        avatarUpdatedAt: leader.avatarUpdatedAt,
        value: leader[metric],
      }
    : null;
}

function findTableMate(
  results: YearRecapResultSource[],
  personalResults: YearRecapResultSource[],
  groupPlayerId: string,
): YearRecapSummary["player"]["tableMate"] {
  const personalGameIds = new Set(personalResults.map((result) => result.gameId));
  const counts = new Map<string, YearRecapSummary["player"]["tableMate"]>();
  for (const result of results) {
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
    });
  }
  return [...counts.values()].sort((left, right) =>
    right!.value - left!.value ||
    left!.displayName.localeCompare(right!.displayName, "ja"),
  )[0] ?? null;
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
