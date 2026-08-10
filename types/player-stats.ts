import type { EquippedAchievement } from "./achievement";

export type PlayerStatsSort =
  | "total"
  | "average"
  | "max-win"
  | "max-loss"
  | "recent"
  | "top-three"
  | "rank-rate";

export interface PlayerStatsRankingRow {
  rank: number;
  groupPlayerId: string;
  displayName: string;
  gamesPlayed: number;
  wins: number;
  topThreeFinishes: number;
  totalNetBb: number;
  averageNetBb: number;
  maxWinBb: number;
  maxLossBb: number;
  recentAverageNetBb: number;
  recentGameCount: number;
  averageRankRate: number | null;
  avatarUpdatedAt: string | null;
  equippedAchievement: EquippedAchievement | null;
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
  winRate: number;
  averageRank: number;
  totalNetBb: number;
  averageNetBb: number;
  maxWinBb: number;
  maxLossBb: number;
}

export interface PlayerStatsDetail {
  summary: PlayerStatsSummary;
  games: PlayerGameStat[];
}
