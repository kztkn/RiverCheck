export interface RevisionResult {
  groupPlayerId: string;
  displayName: string;
  remainingChips: number;
  rebuyCount: number;
  score: number;
  rank: number;
  costShare: number;
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

function hasResultChanged(
  before: RevisionResult,
  after: RevisionResult,
): boolean {
  return (
    before.remainingChips !== after.remainingChips ||
    before.rebuyCount !== after.rebuyCount ||
    before.score !== after.score ||
    before.rank !== after.rank ||
    before.costShare !== after.costShare
  );
}
