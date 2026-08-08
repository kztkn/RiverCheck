export type GameStatus = "draft" | "open" | "finalized";

export interface GameSummary {
  id: string;
  title: string;
  playedAt: string;
  status: GameStatus;
}

export interface GameDetails extends GameSummary {
  groupId: string;
  initialChips: number;
  rebuyChips: number;
  previewParticipantCount: number;
  venueCost: number;
  firstPlaceCost: number;
  secondPlaceCost: number;
  thirdPlaceCost: number;
}

export interface CreateGameInput {
  title: string;
  playedAt: string;
  initialChips: number;
  rebuyChips: number;
  previewParticipantCount: number;
  venueCost: number;
  firstPlaceCost: number;
  secondPlaceCost: number;
  thirdPlaceCost: number;
}
