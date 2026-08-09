import { listGamesForGroup } from "@server/repositories/game-repository.server";
import { findGroupByPublicCode } from "@server/repositories/group-repository.server";
import type { GameListItem } from "@shared-types/game";
import type { GroupSummary } from "@shared-types/group";

export interface GroupOverview {
  group: GroupSummary;
  games: GameListItem[];
}

export async function getGroupOverview(
  publicCode: string,
): Promise<GroupOverview | null> {
  const group = await findGroupByPublicCode(publicCode);
  if (!group) return null;

  const games = await listGamesForGroup(group.id);
  return {
    group,
    games,
  };
}
