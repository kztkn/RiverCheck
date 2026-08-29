import { findGameForGroup } from "@server/repositories/game-repository.server";
import { findGroupByPublicCode } from "@server/repositories/group-repository.server";
import {
  listGameStoryReactionSummaries,
  setGameStoryReactionState,
} from "@server/repositories/game-story-reaction-repository.server";
import { getAuthenticatedPlayerProfile } from "@server/services/player-profile-service.server";
import { isGameStoryReactionType } from "@domain/story/game-story-reaction";
import type { GameStoryReactionSummary } from "@shared-types/game-story-reaction";

export interface GameStoryReactionOverview {
  canReact: boolean;
  reactions: GameStoryReactionSummary[];
}

export async function getGameStoryReactionOverview(
  request: Request,
  groupCode: string,
  gameId: string,
): Promise<GameStoryReactionOverview | null> {
  const group = await findGroupByPublicCode(groupCode);
  if (!group) return null;
  const game = await findGameForGroup(group.id, gameId);
  if (!game || game.status !== "finalized") return null;
  const profileOverview = await getAuthenticatedPlayerProfile(request, groupCode);
  const groupPlayerId = profileOverview?.profile?.groupPlayerId ?? null;
  return {
    canReact: groupPlayerId !== null,
    reactions: await listGameStoryReactionSummaries(
      group.id,
      gameId,
      groupPlayerId,
    ),
  };
}

export async function saveGameStoryReaction(
  request: Request,
  input: {
    active: boolean;
    gameId: string;
    groupCode: string;
    postId: string;
    reactionType: string;
  },
): Promise<
  | { ok: true; active: boolean; count: number }
  | { ok: false; status: 400 | 403 | 404; error: string }
> {
  if (!isGameStoryReactionType(input.reactionType)) {
    return { ok: false, status: 400, error: "リアクションの種類が不正です。" };
  }
  const group = await findGroupByPublicCode(input.groupCode);
  if (!group) return { ok: false, status: 404, error: "グループが見つかりません。" };
  const game = await findGameForGroup(group.id, input.gameId);
  if (!game || game.status !== "finalized") {
    return { ok: false, status: 404, error: "確定済みの開催が見つかりません。" };
  }
  const profileOverview = await getAuthenticatedPlayerProfile(
    request,
    input.groupCode,
  );
  const groupPlayerId = profileOverview?.profile?.groupPlayerId ?? null;
  if (!groupPlayerId) {
    return {
      ok: false,
      status: 403,
      error: "プロフィール認証済みのメンバーだけリアクションできます。",
    };
  }
  const saved = await setGameStoryReactionState(
    group.id,
    input.gameId,
    input.postId,
    groupPlayerId,
    input.reactionType,
    input.active,
  );
  return saved
    ? { ok: true, ...saved }
    : { ok: false, status: 404, error: "投稿を確認できませんでした。" };
}
