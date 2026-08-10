import {
  adjustRebuyState,
  applyRebuyAction,
  undoRebuyAction,
  type RebuyActionType,
  type RebuyMutationResult,
  type RebuyTarget,
} from "@server/repositories/rebuy-repository.server";
import { getAuthenticatedPlayerProfile } from "./player-profile-service.server";
import { readParticipantToken } from "./participant-session.server";
import { hashToken } from "./token.server";

export type RebuyServiceResult =
  | {
      ok: true;
      eventId: string | null;
      state: {
        totalRebuyCount: number;
        outstandingRebuyCount: number;
      };
    }
  | { ok: false; error: string };

interface RebuyGameContext {
  commandId: string;
  gameId: string;
  groupCode: string;
  groupId: string;
}

export async function recordOwnRebuyAction(
  request: Request,
  input: RebuyGameContext & { actionType: RebuyActionType },
): Promise<RebuyServiceResult> {
  if (!isUuid(input.commandId)) return invalidRequest();
  const targets = await resolveOwnTargets(request, input);
  if (targets.length === 0) return unauthenticated();

  for (const target of targets) {
    const result = await applyRebuyAction({
      actorType: "participant",
      actionType: input.actionType,
      commandId: input.commandId,
      gameId: input.gameId,
      groupId: input.groupId,
      target,
    });
    if (result.ok || result.reason !== "not-found") {
      return mapMutationResult(result);
    }
  }
  return unauthenticated();
}

export async function undoOwnRebuyAction(
  request: Request,
  input: RebuyGameContext & { eventId: string },
): Promise<RebuyServiceResult> {
  if (!isUuid(input.commandId) || !isUuid(input.eventId)) {
    return invalidRequest();
  }
  const targets = await resolveOwnTargets(request, input);
  if (targets.length === 0) return unauthenticated();

  for (const target of targets) {
    const result = await undoRebuyAction({
      actorType: "participant",
      commandId: input.commandId,
      eventId: input.eventId,
      gameId: input.gameId,
      groupId: input.groupId,
      target,
    });
    if (result.ok || result.reason !== "not-found") {
      return mapMutationResult(result);
    }
  }
  return unauthenticated();
}

export async function recordOrganizerRebuyAction(input: {
  actionType: RebuyActionType;
  commandId: string;
  gameId: string;
  groupId: string;
  participantId: string;
}): Promise<RebuyServiceResult> {
  if (!isUuid(input.commandId) || !isUuid(input.participantId)) {
    return invalidRequest();
  }
  return mapMutationResult(
    await applyRebuyAction({
      actorType: "organizer",
      actionType: input.actionType,
      commandId: input.commandId,
      gameId: input.gameId,
      groupId: input.groupId,
      target: { kind: "participant-id", value: input.participantId },
    }),
  );
}

export async function undoOrganizerRebuyAction(input: {
  commandId: string;
  eventId: string;
  gameId: string;
  groupId: string;
  participantId: string;
}): Promise<RebuyServiceResult> {
  if (
    !isUuid(input.commandId) ||
    !isUuid(input.eventId) ||
    !isUuid(input.participantId)
  ) {
    return invalidRequest();
  }
  return mapMutationResult(
    await undoRebuyAction({
      actorType: "organizer",
      commandId: input.commandId,
      eventId: input.eventId,
      gameId: input.gameId,
      groupId: input.groupId,
      target: { kind: "participant-id", value: input.participantId },
    }),
  );
}

export async function adjustOrganizerRebuyState(input: {
  commandId: string;
  gameId: string;
  groupId: string;
  outstandingRebuyCount: number;
  participantId: string;
  settlementRebuyCount: number | null;
  totalRebuyCount: number;
}): Promise<RebuyServiceResult> {
  if (
    !isUuid(input.commandId) ||
    !isUuid(input.participantId) ||
    !isNonNegativeInteger(input.totalRebuyCount) ||
    !isNonNegativeInteger(input.outstandingRebuyCount) ||
    (input.settlementRebuyCount !== null &&
      !isNonNegativeInteger(input.settlementRebuyCount))
  ) {
    return invalidRequest();
  }
  return mapMutationResult(
    await adjustRebuyState({
      actorType: "organizer",
      commandId: input.commandId,
      gameId: input.gameId,
      groupId: input.groupId,
      outstandingRebuyCount: input.outstandingRebuyCount,
      settlementRebuyCount: input.settlementRebuyCount,
      target: { kind: "participant-id", value: input.participantId },
      totalRebuyCount: input.totalRebuyCount,
    }),
  );
}

async function resolveOwnTargets(
  request: Request,
  input: { gameId: string; groupCode: string },
): Promise<RebuyTarget[]> {
  const targets: RebuyTarget[] = [];
  const profile = await getAuthenticatedPlayerProfile(
    request,
    input.groupCode,
  );
  if (profile?.profile?.groupPlayerId) {
    targets.push({
      kind: "group-player",
      value: profile.profile.groupPlayerId,
    });
  }
  const token = readParticipantToken(request, input.gameId);
  if (token) {
    targets.push({ kind: "participant-token", value: await hashToken(token) });
  }
  return targets;
}

function mapMutationResult(result: RebuyMutationResult): RebuyServiceResult {
  if (result.ok) return result;
  if (result.reason === "nothing-to-repay") {
    return { ok: false, error: "未返済のリバイはありません。" };
  }
  if (result.reason === "already-submitted") {
    return {
      ok: false,
      error: "結果入力後はリバイ記録を変更できません。入力を修正してください。",
    };
  }
  if (result.reason === "not-latest") {
    return {
      ok: false,
      error: "直前の操作だけ元に戻せます。画面を更新してください。",
    };
  }
  if (result.reason === "invalid-state") {
    return {
      ok: false,
      error: "累計リバイと未返済口数の組み合わせを確認してください。",
    };
  }
  return unauthenticated();
}

function unauthenticated(): RebuyServiceResult {
  return {
    ok: false,
    error: "参加者情報を確認できません。画面を更新してください。",
  };
}

function invalidRequest(): RebuyServiceResult {
  return { ok: false, error: "リバイ操作の内容を確認してください。" };
}

function isNonNegativeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
