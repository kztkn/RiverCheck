import type { AchievementIconKey } from "./achievement";

export interface YearRecapResultSource {
  gameId: string;
  gameTitle: string;
  playedAt: string;
  groupPlayerId: string;
  displayName: string;
  avatarUpdatedAt: string | null;
  rank: number;
  totalRebuyCount: number;
  netBb: number;
}

export interface YearRecapStoryStats {
  postsCreated: number;
  reactionsReceived: number;
  reactedPostCount: number;
}

export interface YearRecapAchievement {
  id: string;
  name: string;
  iconKey: AchievementIconKey;
  unlockedAt: string;
}

export interface YearRecapPlayerHighlight {
  groupPlayerId: string;
  displayName: string;
  avatarUpdatedAt: string | null;
  value: number;
}

export interface YearRecapGameHighlight {
  gameId: string;
  gameTitle: string;
  playedAt: string;
  rank: number;
  netBb: number;
}

export interface YearRecapSummary {
  year: number;
  group: {
    gamesPlayed: number;
    totalEntries: number;
    uniquePlayers: number;
    totalRebuys: number;
    mostActivePlayer: YearRecapPlayerHighlight | null;
    mostWinsPlayer: YearRecapPlayerHighlight | null;
  };
  player: {
    groupPlayerId: string;
    displayName: string;
    avatarUpdatedAt: string | null;
    gamesPlayed: number;
    attendanceRate: number;
    wins: number;
    topThreeFinishes: number;
    totalNetBb: number;
    totalRebuys: number;
    bestGame: YearRecapGameHighlight | null;
    tableMate: YearRecapPlayerHighlight | null;
  };
  stories: YearRecapStoryStats;
  achievements: YearRecapAchievement[];
}
