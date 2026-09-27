import {
  buildYearRecap,
  getTokyoYearRange,
} from "@domain/year-recap/build-year-recap";
import {
  findYearRecapStoryStats,
  listYearRecapAchievements,
  listYearRecapResults,
} from "@server/repositories/year-recap-repository.server";
import type { PlayerProfileRecord } from "@server/repositories/player-profile-repository.server";
import type { YearRecapSummary } from "@shared-types/year-recap";

export async function getYearRecap(
  groupId: string,
  profile: PlayerProfileRecord,
  year: number,
): Promise<YearRecapSummary> {
  const { startAt, endAt } = getTokyoYearRange(year);
  const [results, stories, achievements] = await Promise.all([
    listYearRecapResults(groupId, startAt, endAt),
    findYearRecapStoryStats(
      groupId,
      profile.groupPlayerId,
      startAt,
      endAt,
    ),
    listYearRecapAchievements(
      groupId,
      profile.groupPlayerId,
      startAt,
      endAt,
    ),
  ]);

  return buildYearRecap({
    year,
    groupPlayerId: profile.groupPlayerId,
    displayName: profile.displayName,
    avatarUpdatedAt: profile.avatarUploadedAt,
    results,
    stories,
    achievements,
  });
}
