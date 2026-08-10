export interface RevisionResult {
  groupPlayerId: string;
  displayName: string;
  remainingChips: number;
  totalRebuyCount: number | null;
  settlementRebuyCount: number;
  trackedOutstandingRebuyCount: number | null;
  score: number;
  rank: number;
  costShare: number;
}

export interface ResultCorrectionInput {
  groupPlayerId: string;
  remainingChips: number;
  totalRebuyCount: number;
  settlementRebuyCount: number;
}

export interface ResultRevisionChange {
  groupPlayerId: string;
  displayName: string;
  before: RevisionResult;
  after: RevisionResult;
}

export function buildResultRevisionChanges(
  beforeResults: RevisionResult[],
  afterResults: RevisionResult[],
): ResultRevisionChange[] {
  const beforeById = new Map(
    beforeResults.map((result) => [result.groupPlayerId, result]),
  );
  const changes: ResultRevisionChange[] = [];

  for (const after of afterResults) {
    const before = beforeById.get(after.groupPlayerId);
    if (!before) continue;
    if (!hasResultChanged(before, after)) continue;
    changes.push({
      groupPlayerId: after.groupPlayerId,
      displayName: after.displayName,
      before,
      after,
    });
  }

  return changes;
}

export function hasResultInputChanges(
  beforeResults: RevisionResult[],
  corrections: ResultCorrectionInput[],
): boolean {
  if (beforeResults.length !== corrections.length) return true;
  const correctionByPlayerId = new Map(
    corrections.map((correction) => [correction.groupPlayerId, correction]),
  );
  if (correctionByPlayerId.size !== corrections.length) return true;
  return beforeResults.some((before) => {
    const correction = correctionByPlayerId.get(before.groupPlayerId);
    return (
      !correction ||
      correction.remainingChips !== before.remainingChips ||
      correction.totalRebuyCount !==
        (before.totalRebuyCount ?? before.settlementRebuyCount) ||
      correction.settlementRebuyCount !== before.settlementRebuyCount
    );
  });
}

function hasResultChanged(
  before: RevisionResult,
  after: RevisionResult,
): boolean {
  return (
    before.remainingChips !== after.remainingChips ||
    before.totalRebuyCount !== after.totalRebuyCount ||
    before.settlementRebuyCount !== after.settlementRebuyCount ||
    before.trackedOutstandingRebuyCount !==
      after.trackedOutstandingRebuyCount ||
    before.score !== after.score ||
    before.rank !== after.rank ||
    before.costShare !== after.costShare
  );
}
