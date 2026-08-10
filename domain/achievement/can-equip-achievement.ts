export function canEquipAchievement(
  achievementId: string | null,
  unlockedAchievementIds: Iterable<string>,
): boolean {
  if (achievementId === null) return true;
  return new Set(unlockedAchievementIds).has(achievementId);
}
