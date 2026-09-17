export type PlayerStatsSort =
  | "total"
  | "average"
  | "max-win"
  | "max-loss"
  | "recent"
  | "top-three"
  | "rank-rate";

export interface PlayerRankingMetrics {
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
}
