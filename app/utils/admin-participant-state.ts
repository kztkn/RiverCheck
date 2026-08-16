export type AdminParticipantInputState =
  | "pending"
  | "complete"
  | "warning";

type ParticipantInput = {
  remainingChips: number | null;
  outstandingRebuyCount: number;
  settlementRebuyCount: number | null;
};

export function getAdminParticipantInputState(
  participant: ParticipantInput,
): AdminParticipantInputState {
  if (
    participant.remainingChips === null ||
    participant.settlementRebuyCount === null
  ) {
    return "pending";
  }
  return participant.outstandingRebuyCount === participant.settlementRebuyCount
    ? "complete"
    : "warning";
}

export function summarizeAdminParticipantStates(
  participants: ParticipantInput[],
): Record<AdminParticipantInputState, number> {
  return participants.reduce<Record<AdminParticipantInputState, number>>(
    (summary, participant) => {
      summary[getAdminParticipantInputState(participant)] += 1;
      return summary;
    },
    { pending: 0, complete: 0, warning: 0 },
  );
}


