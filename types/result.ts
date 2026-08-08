export interface GameResultSummary {
  groupPlayerId: string;
  displayName: string;
  remainingChips: number;
  rebuyCount: number;
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
