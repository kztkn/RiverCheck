export interface GroupPlayerSummary {
  id: string;
  displayName: string;
  isActive: boolean;
  profileMessage: string | null;
  avatarUpdatedAt: string | null;
  hasProfileAccess: boolean;
}

export interface ReusablePlayerSummary {
  playerId: string;
  displayName: string;
  avatarUpdatedAt: string | null;
  hasProfileAccess: boolean;
  groupNames: string[];
  sourceGroupCode: string | null;
  sourceGroupPlayerId: string | null;
}

export interface PlayerProfile {
  playerId: string;
  groupPlayerId: string;
  displayName: string;
  profileMessage: string | null;
  favoriteCard1: string | null;
  favoriteCard2: string | null;
  equippedAchievementId: string | null;
  avatarUpdatedAt: string | null;
  updatedAt: string;
}

export interface CurrentGameParticipant {
  groupPlayerId: string;
  displayName: string;
  statusText?: string | null;
}

export interface GameParticipantSummary {
  id: string;
  groupPlayerId: string;
  displayName: string;
  status: "joined" | "submitted" | "locked";
  remainingChips: number | null;
  totalRebuyCount: number | null;
  outstandingRebuyCount: number;
  settlementRebuyCount: number | null;
  deviceLocked: boolean;
  avatarUpdatedAt: string | null;
}

export interface RegisteredPlayerOption {
  id: string;
  displayName: string;
  deviceLocked: boolean;
  avatarUpdatedAt: string | null;
}
