import {
  addCumulativeNetBb,
  calculatePlayerStats,
} from "@domain/player-stats/calculate-player-stats";
import { findGroupByPublicCode } from "@server/repositories/group-repository.server";
import {
  findPlayerStatsIdentity,
  listFinalizedPlayerGameStats,
  listPlayerStatsRanking,
} from "@server/repositories/player-stats-repository.server";
import type { GroupSummary } from "@shared-types/group";
import type {
  PlayerStatsDetail,
  PlayerStatsRankingRow,
  PlayerStatsSort,
} from "@shared-types/player-stats";
import type { PlayerAchievementCollection } from "@shared-types/achievement";
import { getPlayerAchievementCollection } from "@server/services/achievement-service.server";

export interface PlayerStatsRankingOverview {
  group: GroupSummary;
  ranking: PlayerStatsRankingRow[];
  sort: PlayerStatsSort;
}

export interface PlayerStatsDetailOverview {
  group: GroupSummary;
  achievements: PlayerAchievementCollection;
  playerStats: PlayerStatsDetail;
}

export function parsePlayerStatsSort(value: string | null): PlayerStatsSort {
  const sorts: PlayerStatsSort[] = [
    "total",
    "average",
    "max-win",
    "max-loss",
    "recent",
    "top-three",
    "rank-rate",
  ];
  return sorts.includes(value as PlayerStatsSort)
    ? value as PlayerStatsSort
    : "total";
}

export async function getPlayerStatsRanking(
  publicCode: string,
  sort: PlayerStatsSort,
): Promise<PlayerStatsRankingOverview | null> {
  const group = await findGroupByPublicCode(publicCode);
  if (!group) return null;

  return {
    group,
    ranking: await listPlayerStatsRanking(group.id, sort),
    sort,
  };
}

export async function getPlayerStatsDetail(
  publicCode: string,
  groupPlayerId: string,
): Promise<PlayerStatsDetailOverview | null> {
  const group = await findGroupByPublicCode(publicCode);
  if (!group) return null;

  const identity = await findPlayerStatsIdentity(group.id, groupPlayerId);
  if (!identity) return null;

  const [finalizedGames, achievements] = await Promise.all([
    listFinalizedPlayerGameStats(group.id, groupPlayerId),
    getPlayerAchievementCollection(group.id, groupPlayerId),
  ]);
  const aggregate = calculatePlayerStats(finalizedGames);
  const gamesWithCumulative = addCumulativeNetBb(finalizedGames);

  return {
    group,
    achievements,
    playerStats: {
      summary: {
        ...identity,
        ...aggregate,
      },
      games: gamesWithCumulative.map((game) => {
        const source = finalizedGames.find(
          (finalizedGame) => finalizedGame.gameId === game.gameId,
        );
        if (!source) throw new Error("Player stats game could not be mapped");
        return {
          ...source,
          cumulativeNetBb: game.cumulativeNetBb,
        };
      }),
    },
  };
}
