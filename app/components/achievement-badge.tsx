import { AchievementIcon } from "./achievement-icon";
import type { EquippedAchievement } from "@shared-types/achievement";

export function AchievementBadge({
  achievement,
  compact = false,
}: {
  achievement: EquippedAchievement;
  compact?: boolean;
}) {
  return (
    <span
      className={`achievement-badge${compact ? " achievement-badge-compact" : ""}`}
      title={achievement.description}
    >
      <AchievementIcon iconKey={achievement.iconKey} />
      <span>{achievement.name}</span>
    </span>
  );
}
