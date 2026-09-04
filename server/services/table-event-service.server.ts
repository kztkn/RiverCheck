import { validateAllInSelection } from "@domain/table-events/validate-table-event";
import { findGameForGroup } from "@server/repositories/game-repository.server";
import { findGroupByPublicCode } from "@server/repositories/group-repository.server";
import {
  findParticipantByGroupPlayerId,
  findParticipantByTokenHash,
  listCurrentGameParticipants,
} from "@server/repositories/participant-repository.server";
import {
  cancelTableEvent,
  createAllInTableEvent,
  createBombPotTableEvent,
  createSevenDeuceTableEvent,
  listOpenGameTableEvents,
  type TableEventActorType,
} from "@server/repositories/table-event-repository.server";
import { isOrganizerAuthenticated } from "@server/services/organizer-auth.server";
import { readParticipantToken } from "@server/services/participant-session.server";
import { getAuthenticatedPlayerProfile } from "@server/services/player-profile-service.server";
import { hashToken } from "@server/services/token.server";

interface TableEventActor {
  groupPlayerId: string | null;
  type: TableEventActorType;
}

export type TableEventCommand =
  | {
      type: "seven_deuce";
      commandId: string;
      subjectGroupPlayerId: string;
    }
  | { type: "bomb_pot"; commandId: string }
  | {
      type: "all_in";
      commandId: string;
      participantIds: string[];
      winnerIds: string[];
    };

export async function getTableEventPanel(
  request: Request,
  groupCode: string,
  gameId: string,
) {
  const context = await requireTableEventGame(groupCode, gameId);
  if (context.game.status !== "open") {
    return {
      canRecord: false,
      currentGroupPlayerId: null,
      rules: { sevenDeuce: false, bombPot: false },
      participants: [],
      recentEvents: [],
    };
  }

  const actor = await resolveTableEventActor(
    request,
    groupCode,
    context.group.id,
    gameId,
  );
  if (!actor) {
    return {
      canRecord: false,
      currentGroupPlayerId: null,
      rules: {
        sevenDeuce: context.game.sevenDeuceRuleEnabled,
        bombPot: context.game.bombPotRuleEnabled,
      },
      participants: [],
      recentEvents: [],
    };
  }

  const [participants, recentEvents] = await Promise.all([
    listCurrentGameParticipants(context.group.id, gameId),
    listOpenGameTableEvents(context.group.id, gameId),
  ]);
  return {
    canRecord: true,
    currentGroupPlayerId: actor.groupPlayerId,
    rules: {
      sevenDeuce: context.game.sevenDeuceRuleEnabled,
      bombPot: context.game.bombPotRuleEnabled,
    },
    participants: participants.map((participant) => ({
      groupPlayerId: participant.groupPlayerId,
      displayName: participant.displayName,
    })),
    recentEvents: recentEvents.map((event) => ({
      ...event,
      canCancel:
        actor.type === "organizer" ||
        (actor.groupPlayerId !== null &&
          event.recordedByGroupPlayerId === actor.groupPlayerId),
    })),
  };
}

export async function recordTableEvent(
  request: Request,
  groupCode: string,
  gameId: string,
  command: TableEventCommand,
): Promise<{ ok: true; eventId: string } | { ok: false; error: string }> {
  const context = await requireTableEventGame(groupCode, gameId);
  if (context.game.status !== "open") {
    return { ok: false, error: "受付中の開催だけ記録できます。" };
  }
  const actor = await resolveTableEventActor(
    request,
    groupCode,
    context.group.id,
    gameId,
  );
  if (!actor) return { ok: false, error: "この開催の記録権限がありません。" };

  let eventId: string | null = null;
  if (command.type === "seven_deuce") {
    if (!context.game.sevenDeuceRuleEnabled) {
      return { ok: false, error: "この開催では72oボーナスはOFFです。" };
    }
    eventId = await createSevenDeuceTableEvent({
      actor,
      commandId: command.commandId,
      gameId,
      groupId: context.group.id,
      subjectGroupPlayerId: command.subjectGroupPlayerId,
    });
  } else if (command.type === "bomb_pot") {
    if (!context.game.bombPotRuleEnabled) {
      return { ok: false, error: "この開催ではBOMB POTはOFFです。" };
    }
    eventId = await createBombPotTableEvent({
      actor,
      commandId: command.commandId,
      gameId,
      groupId: context.group.id,
    });
  } else {
    const validated = validateAllInSelection({
      participantIds: command.participantIds,
      winnerIds: command.winnerIds,
    });
    if (!validated.ok) return validated;
    eventId = await createAllInTableEvent({
      actor,
      commandId: command.commandId,
      gameId,
      groupId: context.group.id,
      participantIds: validated.participantIds,
      winnerIds: validated.winnerIds,
    });
  }

  if (!eventId) {
    return { ok: false, error: "卓イベントを記録できませんでした。画面を更新してください。" };
  }
  return { ok: true, eventId };
}

export async function cancelRecordedTableEvent(
  request: Request,
  groupCode: string,
  gameId: string,
  eventId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const context = await requireTableEventGame(groupCode, gameId);
  if (context.game.status !== "open") {
    return { ok: false, error: "確定後の卓イベントは変更できません。" };
  }
  const actor = await resolveTableEventActor(
    request,
    groupCode,
    context.group.id,
    gameId,
  );
  if (!actor) return { ok: false, error: "この開催の記録権限がありません。" };
  const canceled = await cancelTableEvent({
    actor,
    eventId,
    gameId,
    groupId: context.group.id,
  });
  return canceled
    ? { ok: true }
    : { ok: false, error: "この卓イベントは取り消せませんでした。" };
}

async function resolveTableEventActor(
  request: Request,
  groupCode: string,
  groupId: string,
  gameId: string,
): Promise<TableEventActor | null> {
  const [profileOverview, organizer] = await Promise.all([
    getAuthenticatedPlayerProfile(request, groupCode),
    isOrganizerAuthenticated(request),
  ]);

  if (organizer) {
    return {
      groupPlayerId: profileOverview?.profile?.groupPlayerId ?? null,
      type: "organizer",
    };
  }

  const profileGroupPlayerId = profileOverview?.profile?.groupPlayerId ?? null;
  if (profileGroupPlayerId) {
    const participant = await findParticipantByGroupPlayerId(
      groupId,
      gameId,
      profileGroupPlayerId,
    );
    if (participant) {
      return { groupPlayerId: participant.groupPlayerId, type: "participant" };
    }
  }

  const token = readParticipantToken(request, gameId);
  if (!token) return null;
  const participant = await findParticipantByTokenHash(
    groupId,
    gameId,
    await hashToken(token),
  );
  return participant
    ? { groupPlayerId: participant.groupPlayerId, type: "participant" }
    : null;
}

async function requireTableEventGame(groupCode: string, gameId: string) {
  const group = await findGroupByPublicCode(groupCode);
  if (!group) throw new Response("Game not found", { status: 404 });
  const game = await findGameForGroup(group.id, gameId);
  if (!game) throw new Response("Game not found", { status: 404 });
  return { group, game };
}
