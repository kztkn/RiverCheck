import { getAuthenticatedPlayerProfile } from "@server/services/player-profile-service.server";
import { acknowledgePlayerAchievementNotification } from "@server/services/achievement-service.server";
import type { Route } from "./+types/achievement-notifications";

export async function action({ request, params }: Route.ActionArgs) {
  const overview = await getAuthenticatedPlayerProfile(request, params.groupCode);
  const profile = overview?.profile ?? null;
  if (!overview || !profile) {
    throw new Response("Forbidden", { status: 403 });
  }

  const formData = await request.formData();
  const playerAchievementId = formData.get("playerAchievementId");
  if (
    typeof playerAchievementId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      playerAchievementId,
    )
  ) {
    throw new Response("Bad Request", { status: 400 });
  }

  const acknowledged = await acknowledgePlayerAchievementNotification(
    overview.group.id,
    profile.groupPlayerId,
    playerAchievementId,
  );
  if (!acknowledged) {
    throw new Response("Not Found", { status: 404 });
  }
  return { ok: true as const };
}
