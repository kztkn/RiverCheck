import { findGroupByPublicCode } from "@server/repositories/group-repository.server";
import { readParticipantToken } from "@server/services/participant-session.server";
import { getAuthenticatedPlayerProfile } from "@server/services/player-profile-service.server";
import { isOrganizerAuthenticated } from "@server/services/organizer-auth.server";
import { hashToken } from "@server/services/token.server";
import { getGameStoryPhotoForDelivery } from "@server/services/game-story-service.server";
import type { Route } from "./+types/game-story-photo";

export async function loader({ request, params }: Route.LoaderArgs) {
  const group = await findGroupByPublicCode(params.groupCode);
  if (!group) throw new Response("Photo not found", { status: 404 });

  const [organizer, profile] = await Promise.all([
    isOrganizerAuthenticated(request),
    getAuthenticatedPlayerProfile(request, params.groupCode),
  ]);
  const token = readParticipantToken(request, params.gameId);
  const delivery = await getGameStoryPhotoForDelivery(
    group.id,
    params.gameId,
    params.postId,
    {
      groupPlayerId: profile?.profile?.groupPlayerId ?? null,
      organizer,
      participantTokenHash: token ? await hashToken(token) : null,
    },
  );
  if (!delivery) throw new Response("Photo not found", { status: 404 });

  const headers = new Headers();
  delivery.object.writeHttpMetadata(headers);
  headers.set("Cache-Control", "private, max-age=3600");
  headers.set("Content-Length", String(delivery.object.size));
  headers.set("Content-Type", delivery.contentType);
  headers.set("ETag", delivery.object.httpEtag);
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(delivery.object.body, { headers });
}
