import type { EquippedAchievement } from "./achievement";
import type { PlayerRankingMetrics, PlayerStatsSort } from "../domain/player-stats/ranking-types";

export type { PlayerStatsSort } from "../domain/player-stats/ranking-types";

export interface PlayerStatsAggregate extends PlayerRankingMetrics {
  avatarUpdatedAt: string | null;
  equippedAchievement: EquippedAchievement | null;
}

export interface PlayerStatsRankingRow extends PlayerStatsAggregate {
  rank: number;
  previousRanks: Record<PlayerStatsSort, number | null>;
}

export interface PlayerStatsRankingSnapshots {
  current: PlayerStatsAggregate[];
  previous: PlayerStatsAggregate[];
}

export interface PlayerGameStat {
  gameId: string;
  gameTitle: string;
  playedAt: string;
  rank: number;
  totalRebuyCount: number | null;
  settlementRebuyCount: number;
  netBb: number;
  cumulativeNetBb: number;
}

export interface PlayerStatsSummary {
  groupPlayerId: string;
  displayName: string;
  profileMessage: string | null;
  favoriteCard1: string | null;
  favoriteCard2: string | null;
  avatarUpdatedAt: string | null;
  gamesPlayed: number;
  wins: number;
  topThreeFinishes: number;
  topThreeRate: number;
  positiveFinishes: number;
  positiveRate: number;
  totalNetBb: number;
  averageNetBb: number;
  maxWinBb: number;
  maxLossBb: number;
}

export interface PlayerStatsDetail {
  summary: PlayerStatsSummary;
  games: PlayerGameStat[];
}
