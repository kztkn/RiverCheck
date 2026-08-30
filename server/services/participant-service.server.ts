import {
  findParticipantByGroupPlayerId,
  joinAuthenticatedParticipant,
  joinExistingPlayerToGroupGame,
} from "@server/repositories/participant-repository.server";
import {
  getAuthenticatedPlayerIdentity,
  getAuthenticatedPlayerProfile,
} from "./player-profile-service.server";
import { generateOpaqueToken, hashToken } from "./token.server";

export async function joinSelfParticipant(
  request: Request,
  input: {
    gameId: string;
    groupCode: string;
    groupId: string;
  },
): Promise<
  | { ok: true; groupPlayerId: string }
  | { ok: false; error: string }
> {
  const profileOverview = await getAuthenticatedPlayerProfile(
    request,
    input.groupCode,
  );
  const groupPlayerId = profileOverview?.profile?.groupPlayerId;
  if (!groupPlayerId) {
    return {
      ok: false,
      error: "本人プロフィールを確認できません。再読み込みしてください。",
    };
  }

  const joined = await joinAuthenticatedParticipant(
    input.groupId,
    input.gameId,
    groupPlayerId,
    await hashToken(generateOpaqueToken()),
  );
  if (joined) return { ok: true, groupPlayerId };

  const existing = await findParticipantByGroupPlayerId(
    input.groupId,
    input.gameId,
    groupPlayerId,
  );
  return existing
    ? { ok: true, groupPlayerId }
    : {
      ok: false,
      error: "参加できませんでした。受付状況またはプロフィールを確認してください。",
    };
}

export async function joinCurrentProfileToGroupGame(
  request: Request,
  input: { gameId: string; groupId: string },
): Promise<
  | { ok: true; displayName: string; groupPlayerId: string }
  | { ok: false; error: string }
> {
  const identity = await getAuthenticatedPlayerIdentity(request);
  if (!identity) {
    return {
      ok: false,
      error: "保存済みの本人プロフィールを確認できません。画面を更新してください。",
    };
  }

  const groupPlayerId = await joinExistingPlayerToGroupGame(
    input.groupId,
    input.gameId,
    identity.playerId,
    await hashToken(generateOpaqueToken()),
  );
  return groupPlayerId
    ? {
        ok: true,
        displayName: identity.displayName,
        groupPlayerId,
      }
    : {
        ok: false,
        error: "このプロフィールではグループに参加できません。主催者に確認してください。",
      };
}
