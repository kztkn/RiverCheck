import {
  getGameStoryReactionOverview,
  saveGameStoryReaction,
} from "@server/services/game-story-reaction-service.server";
import type { Route } from "./+types/game-story-reactions";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export async function loader({ request, params }: Route.LoaderArgs) {
  const overview = await getGameStoryReactionOverview(
    request,
    params.groupCode,
    params.gameId,
  );
  if (!overview) throw new Response("Not Found", { status: 404 });
  return Response.json(overview, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function action({ request, params }: Route.ActionArgs) {
  const formData = await request.formData();
  const postId = readString(formData, "postId");
  const reactionType = readString(formData, "reactionType");
  const activeValue = readString(formData, "active");
  if (!UUID_PATTERN.test(postId) || !["yes", "no"].includes(activeValue)) {
    return Response.json(
      { ok: false, error: "入力内容を確認してください。" },
      { status: 400 },
    );
  }
  const result = await saveGameStoryReaction(request, {
    active: activeValue === "yes",
    gameId: params.gameId,
    groupCode: params.groupCode,
    postId,
    reactionType,
  });
  return Response.json(
    result.ok
      ? {
          ...result,
          postId,
          reactionType,
        }
      : result,
    {
      status: result.ok ? 200 : result.status,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

function readString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}
