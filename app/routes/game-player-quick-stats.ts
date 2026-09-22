import type { Route } from "./+types/game-player-quick-stats";
import { buildPlayerAvatarUrl } from "@domain/player-profile/build-player-avatar-url";
import { findGameWithGroupByPublicCode } from "@server/repositories/game-repository.server";
import {
  findParticipantByGroupPlayerId,
  findParticipantByTokenHash,
} from "@server/repositories/participant-repository.server";
import { isOrganizerAuthenticated } from "@server/services/organizer-auth.server";
import { readParticipantToken } from "@server/services/participant-session.server";
import { getAuthenticatedPlayerProfile } from "@server/services/player-profile-service.server";
import { getPlayerQuickStats } from "@server/services/player-stats-service.server";
import { hashToken } from "@server/services/token.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  if (!isUuid(params.groupPlayerId)) {
    return quickStatsError("プレイヤーを確認できませんでした。", 400);
  }

  const context = await findGameWithGroupByPublicCode(
    params.groupCode,
    params.gameId,
  );
  if (!context || context.game.status !== "open") {
    return quickStatsError("この開催の簡易戦績は表示できません。", 404);
  }

  const [organizer, profileOverview] = await Promise.all([
    isOrganizerAuthenticated(request),
    getAuthenticatedPlayerProfile(request, params.groupCode),
  ]);
  let canView = organizer || Boolean(profileOverview?.profile);

  if (!canView) {
    const token = readParticipantToken(request, params.gameId);
    const currentParticipant = token
      ? await findParticipantByTokenHash(
          context.group.id,
          params.gameId,
          await hashToken(token),
        )
      : null;
    canView = Boolean(currentParticipant);
  }

  if (!canView) {
    return quickStatsError("参加者だけが簡易戦績を確認できます。", 403);
  }

  const target = await findParticipantByGroupPlayerId(
    context.group.id,
    params.gameId,
    params.groupPlayerId,
  );
  if (!target) {
    return quickStatsError("この開催の参加者を確認できませんでした。", 404);
  }

  const stats = await getPlayerQuickStats(
    context.group.id,
    params.groupPlayerId,
  );

  return Response.json(
    {
      ok: true as const,
      groupPlayerId: target.groupPlayerId,
      displayName: target.displayName,
      avatarUrl: buildPlayerAvatarUrl({
        avatarUpdatedAt: target.avatarUpdatedAt,
        groupCode: params.groupCode,
        groupPlayerId: target.groupPlayerId,
      }),
      ...stats,
    },
    {
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}

function quickStatsError(error: string, status: number) {
  return Response.json(
    { ok: false as const, error },
    {
      status,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
    value,
  );
}
