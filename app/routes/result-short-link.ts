import { redirect } from "react-router";
import { decodeResultCode } from "@domain/result-sharing/result-code";
import { findFinalizedGamePublicRoute } from "@server/repositories/game-repository.server";
import type { Route } from "./+types/result-short-link";

export async function loader({ params }: Route.LoaderArgs) {
  const gameId = decodeResultCode(params.resultCode);
  if (!gameId) throw new Response("Result not found", { status: 404 });

  const resultRoute = await findFinalizedGamePublicRoute(gameId);
  if (!resultRoute) {
    throw new Response("Result not found", { status: 404 });
  }

  return redirect(
    `/g/${resultRoute.groupPublicCode}/games/${resultRoute.gameId}`,
  );
}
