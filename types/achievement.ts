export type AchievementIconKey =
  | "trophy"
  | "flame"
  | "calendar-check"
  | "trending-up"
  | "badge-check"
  | "cards"
  | "bolt"
  | "refresh"
  | "notes"
  | "heart"
  | "arrows-up-down";

export interface AchievementSummary {
  id: string;
  code: string;
  name: string;
  description: string;
  iconKey: AchievementIconKey;
  category: string;
}

export interface EquippedAchievement extends AchievementSummary {}

export interface PlayerAchievementItem extends AchievementSummary {
  isHidden: boolean;
  isUnlocked: boolean;
  isEquipped: boolean;
  unlockedAt: string | null;
  sourceGame: {
    id: string;
    title: string;
    playedAt: string;
  } | null;
}

export interface PlayerAchievementCollection {
  unlockedCount: number;
  totalCount: number;
  equippedAchievement: EquippedAchievement | null;
  items: PlayerAchievementItem[];
}

export interface PendingAchievementNotification extends AchievementSummary {
  playerAchievementId: string;
}
