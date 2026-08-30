import { listGroups, listGroupsForPlayer } from "@server/repositories/group-repository.server";
import { isOrganizerAuthenticated } from "@server/services/organizer-auth.server";
import { getAuthenticatedPlayerIdentity } from "@server/services/player-profile-service.server";

export async function getHomeEntryGroups(request: Request) {
  const [identity, organizer] = await Promise.all([
    getAuthenticatedPlayerIdentity(request),
    isOrganizerAuthenticated(request),
  ]);

  const groups = organizer
    ? await listGroups()
    : identity
      ? await listGroupsForPlayer(identity.playerId)
      : [];

  return { groups, organizer };
}
