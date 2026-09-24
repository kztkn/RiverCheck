import type { GameDetails } from "@shared-types/game";
import type { GroupSummary } from "@shared-types/group";
import { hasGroupEventCreatorPermission } from "@server/repositories/game-authorization-repository.server";
import { isOrganizerAuthenticated } from "@server/services/organizer-auth.server";
import { getAuthenticatedPlayerIdentity } from "@server/services/player-profile-service.server";

export type GameManagementActor =
  | { kind: "admin"; playerId: string | null }
  | { kind: "creator"; playerId: string };

export async function requireGroupEventCreator(
  request: Request,
  group: GroupSummary,
): Promise<GameManagementActor> {
  const [admin, identity] = await Promise.all([
    isOrganizerAuthenticated(request),
    getAuthenticatedPlayerIdentity(request),
  ]);
  if (admin) return { kind: "admin", playerId: identity?.playerId ?? null };
  if (
    identity &&
    await hasGroupEventCreatorPermission(group.id, identity.playerId)
  ) {
    return { kind: "creator", playerId: identity.playerId };
  }
  throw new Response("Forbidden", { status: 403 });
}

export async function getGameManagementActor(
  request: Request,
  game: Pick<GameDetails, "createdByPlayerId">,
): Promise<GameManagementActor | null> {
  const [admin, identity] = await Promise.all([
    isOrganizerAuthenticated(request),
    getAuthenticatedPlayerIdentity(request),
  ]);
  if (admin) return { kind: "admin", playerId: identity?.playerId ?? null };
  if (
    identity &&
    game.createdByPlayerId !== null &&
    game.createdByPlayerId === identity.playerId
  ) {
    return { kind: "creator", playerId: identity.playerId };
  }
  return null;
}

export async function requireGameManager(
  request: Request,
  game: Pick<GameDetails, "createdByPlayerId">,
): Promise<GameManagementActor> {
  const actor = await getGameManagementActor(request, game);
  if (!actor) throw new Response("Forbidden", { status: 403 });
  return actor;
}
