import { getGamePhotoForDelivery } from "@server/services/game-highlight-service.server";
import type { Route } from "./+types/game-photo";

export async function loader({ params }: Route.LoaderArgs) {
  const delivery = await getGamePhotoForDelivery(
    params.groupCode,
    params.gameId,
  );
  if (!delivery) throw new Response("Photo not found", { status: 404 });

  const headers = new Headers();
  delivery.object.writeHttpMetadata(headers);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  headers.set("Content-Length", String(delivery.object.size));
  headers.set("Content-Type", delivery.contentType);
  headers.set("ETag", delivery.object.httpEtag);
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(delivery.object.body, { headers });
}
