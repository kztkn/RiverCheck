import { getPlayerAvatarForDelivery } from "@server/services/player-profile-service.server";
import type { Route } from "./+types/player-avatar";

export async function loader({ params }: Route.LoaderArgs) {
  const delivery = await getPlayerAvatarForDelivery(
    params.groupCode,
    params.groupPlayerId,
  );
  if (!delivery) throw new Response("Avatar not found", { status: 404 });

  const headers = new Headers();
  delivery.object.writeHttpMetadata(headers);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  headers.set("Content-Length", String(delivery.object.size));
  headers.set("Content-Type", delivery.contentType);
  headers.set("ETag", delivery.object.httpEtag);
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(delivery.object.body, { headers });
}
