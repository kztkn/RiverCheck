import { withTransaction, type DatabaseTransaction } from "@server/db/client.server";
import {
  applyRebuyDelta,
  transitionRebuyState,
  validateRebuyState,
  type RebuyState,
} from "@domain/rebuy/rebuy-state";

export type { RebuyState } from "@domain/rebuy/rebuy-state";

export type RebuyActorType = "participant" | "organizer";
export type RebuyActionType = "rebuy" | "repayment";

export type RebuyTarget =
  | { kind: "group-player"; value: string }
  | { kind: "participant-token"; value: string }
  | { kind: "participant-id"; value: string };

export type RebuyMutationResult =
  | { ok: true; eventId: string | null; state: RebuyState }
  | {
      ok: false;
      reason:
        | "not-found"
        | "already-submitted"
        | "nothing-to-repay"
        | "invalid-state"
        | "not-latest";
    };

interface LockedParticipantRow {
  id: string;
  status: "joined" | "submitted" | "locked";
  total_rebuy_count: number | null;
  outstanding_rebuy_count: number;
  settlement_rebuy_count: number | null;
}

interface EventRow {
  id: string;
  total_delta: number;
  outstanding_delta: number;
}

export async function applyRebuyAction(input: {
  actorType: RebuyActorType;
  actionType: RebuyActionType;
  commandId: string;
  gameId: string;
  groupId: string;
  target: RebuyTarget;
}): Promise<RebuyMutationResult> {
  return withTransaction(async (transaction) => {
    const participant = await lockParticipant(transaction, input);
    if (!participant) return { ok: false, reason: "not-found" };
    if (participant.status === "locked") {
      return { ok: false, reason: "already-submitted" };
    }

    const repeated = await findCommandEvent(
      transaction,
      participant.id,
      input.commandId,
    );
    if (repeated) {
      return {
        ok: true,
        eventId: repeated.id,
        state: mapState(participant),
      };
    }

    const totalDelta = input.actionType === "rebuy" ? 1 : 0;
    const outstandingDelta = input.actionType === "rebuy" ? 1 : -1;
    let state: RebuyState;
    try {
      state = transitionRebuyState(mapState(participant), input.actionType);
    } catch {
      return {
        ok: false,
        reason:
          input.actionType === "repayment" &&
          participant.outstanding_rebuy_count === 0
            ? "nothing-to-repay"
            : "invalid-state",
      };
    }

    await updateParticipantState(transaction, participant.id, state);
    const eventId = await insertEvent(transaction, {
      actorType: input.actorType,
      commandId: input.commandId,
      eventType: input.actionType,
      outstandingDelta,
      participantId: participant.id,
      revertsEventId: null,
      totalDelta,
    });
    return { ok: true, eventId, state };
  });
}

export async function undoRebuyAction(input: {
  actorType: RebuyActorType;
  commandId: string;
  eventId: string;
  gameId: string;
  groupId: string;
  target: RebuyTarget;
}): Promise<RebuyMutationResult> {
  return withTransaction(async (transaction) => {
    const participant = await lockParticipant(transaction, input);
    if (!participant) return { ok: false, reason: "not-found" };
    if (participant.status === "locked") {
      return { ok: false, reason: "already-submitted" };
    }

    const repeated = await findCommandEvent(
      transaction,
      participant.id,
      input.commandId,
    );
    if (repeated) {
      return {
        ok: true,
        eventId: repeated.id,
        state: mapState(participant),
      };
    }

    const latest = await findLatestReversibleEvent(
      transaction,
      participant.id,
    );
    if (!latest || latest.id !== input.eventId) {
      return { ok: false, reason: "not-latest" };
    }

    let state: RebuyState;
    try {
      state = applyRebuyDelta(mapState(participant), {
        totalDelta: -latest.total_delta,
        outstandingDelta: -latest.outstanding_delta,
      });
    } catch {
      return { ok: false, reason: "invalid-state" };
    }

    await updateParticipantState(transaction, participant.id, state);
    const eventId = await insertEvent(transaction, {
      actorType: input.actorType,
      commandId: input.commandId,
      eventType: "undo",
      outstandingDelta: -latest.outstanding_delta,
      participantId: participant.id,
      revertsEventId: latest.id,
      totalDelta: -latest.total_delta,
    });
    return { ok: true, eventId, state };
  });
}

export async function adjustRebuyState(input: {
  actorType: "organizer";
  commandId: string;
  gameId: string;
  groupId: string;
  outstandingRebuyCount: number;
  settlementRebuyCount: number | null;
  target: Extract<RebuyTarget, { kind: "participant-id" }>;
  totalRebuyCount: number;
}): Promise<RebuyMutationResult> {
  return withTransaction(async (transaction) => {
    const participant = await lockParticipant(transaction, input);
    if (!participant) return { ok: false, reason: "not-found" };
    const state = {
      totalRebuyCount: input.totalRebuyCount,
      outstandingRebuyCount: input.outstandingRebuyCount,
    };
    try {
      validateRebuyState(state);
      if (
        input.settlementRebuyCount !== null &&
        input.settlementRebuyCount > input.totalRebuyCount
      ) {
        return { ok: false, reason: "invalid-state" };
      }
    } catch {
      return { ok: false, reason: "invalid-state" };
    }

    const repeated = await findCommandEvent(
      transaction,
      participant.id,
      input.commandId,
    );
    if (repeated) {
      return {
        ok: true,
        eventId: repeated.id,
        state: mapState(participant),
      };
    }

    const totalDelta = state.totalRebuyCount - (participant.total_rebuy_count ?? 0);
    const outstandingDelta =
      state.outstandingRebuyCount - participant.outstanding_rebuy_count;
    const settlementChanged =
      input.settlementRebuyCount !== participant.settlement_rebuy_count;
    await transaction.query(
      `
        UPDATE game_participants
        SET total_rebuy_count = $2,
            outstanding_rebuy_count = $3,
            settlement_rebuy_count = $4,
            updated_at = NOW()
        WHERE id = $1
      `,
      [
        participant.id,
        state.totalRebuyCount,
        state.outstandingRebuyCount,
        input.settlementRebuyCount,
      ],
    );

    if (totalDelta === 0 && outstandingDelta === 0 && !settlementChanged) {
      return { ok: true, eventId: null, state };
    }
    const eventId = await insertEvent(transaction, {
      actorType: input.actorType,
      commandId: input.commandId,
      eventType: "adjustment",
      outstandingDelta,
      participantId: participant.id,
      revertsEventId: null,
      settlementAfter: input.settlementRebuyCount,
      settlementBefore: participant.settlement_rebuy_count,
      totalDelta,
    });
    return { ok: true, eventId, state };
  });
}

async function lockParticipant(
  transaction: DatabaseTransaction,
  input: { gameId: string; groupId: string; target: RebuyTarget },
): Promise<LockedParticipantRow | null> {
  const targetColumn =
    input.target.kind === "group-player"
      ? "participant.group_player_id"
      : input.target.kind === "participant-token"
        ? "participant.participant_token_hash"
        : "participant.id";
  const result = await transaction.query<LockedParticipantRow>(
    `
      SELECT participant.id,
             participant.status,
             participant.total_rebuy_count,
             participant.outstanding_rebuy_count,
             participant.settlement_rebuy_count
      FROM game_participants AS participant
      INNER JOIN games AS game ON game.id = participant.game_id
      WHERE game.id = $1
        AND game.group_id = $2
        AND game.status = 'open'
        AND ${targetColumn} = $3
      FOR UPDATE OF participant
    `,
    [input.gameId, input.groupId, input.target.value],
  );
  return result.rows[0] ?? null;
}

async function findCommandEvent(
  transaction: DatabaseTransaction,
  participantId: string,
  commandId: string,
): Promise<EventRow | null> {
  const result = await transaction.query<EventRow>(
    `
      SELECT id, total_delta, outstanding_delta
      FROM game_rebuy_events
      WHERE game_participant_id = $1 AND command_id = $2
    `,
    [participantId, commandId],
  );
  return result.rows[0] ?? null;
}

async function findLatestReversibleEvent(
  transaction: DatabaseTransaction,
  participantId: string,
): Promise<EventRow | null> {
  const result = await transaction.query<EventRow>(
    `
      SELECT event.id, event.total_delta, event.outstanding_delta
      FROM game_rebuy_events AS event
      WHERE event.game_participant_id = $1
        AND event.event_type IN ('rebuy', 'repayment')
        AND NOT EXISTS (
          SELECT 1
          FROM game_rebuy_events AS undo
          WHERE undo.reverts_event_id = event.id
        )
      ORDER BY event.recorded_at DESC, event.id DESC
      LIMIT 1
      FOR UPDATE OF event
    `,
    [participantId],
  );
  return result.rows[0] ?? null;
}

async function updateParticipantState(
  transaction: DatabaseTransaction,
  participantId: string,
  state: RebuyState,
): Promise<void> {
  await transaction.query(
    `
      UPDATE game_participants
      SET total_rebuy_count = $2,
          outstanding_rebuy_count = $3,
          updated_at = NOW()
      WHERE id = $1
    `,
    [participantId, state.totalRebuyCount, state.outstandingRebuyCount],
  );
}

async function insertEvent(
  transaction: DatabaseTransaction,
  input: {
    actorType: RebuyActorType;
    commandId: string;
    eventType: "rebuy" | "repayment" | "undo" | "adjustment";
    outstandingDelta: number;
    participantId: string;
    revertsEventId: string | null;
    settlementAfter?: number | null;
    settlementBefore?: number | null;
    totalDelta: number;
  },
): Promise<string> {
  const result = await transaction.query<{ id: string }>(
    `
      INSERT INTO game_rebuy_events (
        command_id, game_participant_id, event_type, total_delta,
        outstanding_delta, recorded_by_type, reverts_event_id,
        settlement_before, settlement_after
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `,
    [
      input.commandId,
      input.participantId,
      input.eventType,
      input.totalDelta,
      input.outstandingDelta,
      input.actorType,
      input.revertsEventId,
      input.settlementBefore ?? null,
      input.settlementAfter ?? null,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new Error("rebuy event was not inserted");
  return row.id;
}

function mapState(participant: LockedParticipantRow): RebuyState {
  return {
    totalRebuyCount: participant.total_rebuy_count ?? 0,
    outstandingRebuyCount: participant.outstanding_rebuy_count,
  };
}

