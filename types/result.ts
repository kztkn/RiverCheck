export interface GameResultSummary {
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

export interface GameResultRevision {
  id: string;
  revisionNumber: number;
  correctedAt: string;
  beforeResults: GameResultSummary[];
  afterResults: GameResultSummary[];
}
