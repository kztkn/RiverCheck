export const TABLE_EVENT_TYPES = [
  "seven_deuce",
  "bomb_pot",
  "all_in",
] as const;

export type TableEventType = (typeof TABLE_EVENT_TYPES)[number];

export interface AllInSelection {
  participantIds: string[];
  winnerIds: string[];
}

export type AllInValidationResult =
  | {
      ok: true;
      participantIds: string[];
      winnerIds: string[];
    }
  | { ok: false; error: string };

export function validateAllInSelection(
  input: AllInSelection,
): AllInValidationResult {
  const participantIds = uniqueNonEmpty(input.participantIds);
  const winnerIds = uniqueNonEmpty(input.winnerIds);

  if (participantIds.length < 2) {
    return { ok: false, error: "ALL INの参加者を2人以上選んでください。" };
  }
  if (winnerIds.length < 1) {
    return { ok: false, error: "勝者を1人以上選んでください。" };
  }
  const participants = new Set(participantIds);
  if (winnerIds.some((winnerId) => !participants.has(winnerId))) {
    return { ok: false, error: "勝者はALL INの参加者から選んでください。" };
  }

  return { ok: true, participantIds, winnerIds };
}

function uniqueNonEmpty(values: string[]): string[] {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter((value) => value !== "")),
  );
}
