import { buildPlayerAvatarUrl } from "@domain/player-profile/build-player-avatar-url";
import { findGroupByPublicCode } from "@server/repositories/group-repository.server";
import { listFinalizedGameTimeline } from "@server/repositories/game-timeline-repository.server";
import type { Route } from "./+types/game-timeline";

export async function loader({ params }: Route.LoaderArgs) {
  const group = await findGroupByPublicCode(params.groupCode);
  if (!group) throw new Response("Game not found", { status: 404 });

  const events = await listFinalizedGameTimeline(group.id, params.gameId);
  return Response.json(
    {
      events: events.map((event) => ({
        id: event.id,
        type: event.type,
        recordedAt: event.recordedAt,
        displayName: event.displayName,
        avatarUrl: buildPlayerAvatarUrl({
          avatarUpdatedAt: event.avatarUpdatedAt,
          groupCode: params.groupCode,
          groupPlayerId: event.groupPlayerId,
        }),
      })),
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
      },
    },
  );
}
