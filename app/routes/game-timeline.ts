import { buildPlayerAvatarUrl } from "@domain/player-profile/build-player-avatar-url";
import { findGroupByPublicCode } from "@server/repositories/group-repository.server";
import { listFinalizedGameTimeline } from "@server/repositories/game-timeline-repository.server";
import { listFinalizedGameTableEvents } from "@server/repositories/table-event-repository.server";
import type { Route } from "./+types/game-timeline";

export async function loader({ params }: Route.LoaderArgs) {
  const group = await findGroupByPublicCode(params.groupCode);
  if (!group) throw new Response("Game not found", { status: 404 });

  const [rebuyEvents, tableEvents] = await Promise.all([
    listFinalizedGameTimeline(group.id, params.gameId),
    listFinalizedGameTableEvents(group.id, params.gameId),
  ]);

  const events = [
    ...rebuyEvents.map((event) => ({
      id: event.id,
      type: event.type,
      recordedAt: event.recordedAt,
      groupPlayerId: event.groupPlayerId,
      displayName: event.displayName,
      avatarUrl: buildPlayerAvatarUrl({
        avatarUpdatedAt: event.avatarUpdatedAt,
        groupCode: params.groupCode,
        groupPlayerId: event.groupPlayerId,
      }),
    })),
    ...tableEvents.map((event) => ({
      id: event.id,
      type: event.type,
      recordedAt: event.recordedAt,
      subject: event.subject
        ? {
            groupPlayerId: event.subject.groupPlayerId,
            displayName: event.subject.displayName,
            avatarUrl: buildPlayerAvatarUrl({
              avatarUpdatedAt: event.subject.avatarUpdatedAt,
              groupCode: params.groupCode,
              groupPlayerId: event.subject.groupPlayerId,
            }),
          }
        : null,
      players: event.players,
    })),
  ].sort((left, right) => {
    const time = left.recordedAt.localeCompare(right.recordedAt);
    return time !== 0 ? time : left.id.localeCompare(right.id);
  });

  return Response.json(
    { events },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
