import {
  findParticipantByGroupPlayerId,
  joinAuthenticatedParticipant,
} from "@server/repositories/participant-repository.server";
import { getAuthenticatedPlayerProfile } from "./player-profile-service.server";
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
