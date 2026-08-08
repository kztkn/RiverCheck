export type PlayerStatsSort = "total" | "average";

export interface PlayerStatsRankingRow {
  rank: number;
  groupPlayerId: string;
  displayName: string;
  gamesPlayed: number;
  wins: number;
  totalNetBb: number;
  averageNetBb: number;
  avatarUpdatedAt: string | null;
}

export interface PlayerGameStat {
  gameId: string;
  gameTitle: string;
  playedAt: string;
  rank: number;
  rebuyCount: number;
  netBb: number;
  cumulativeNetBb: number;
}

export interface PlayerStatsSummary {
  groupPlayerId: string;
  displayName: string;
  profileMessage: string | null;
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
