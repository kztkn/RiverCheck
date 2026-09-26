export type GameStatus = "draft" | "open" | "finalized";

export interface GameChipAllocation {
  denomination: number;
  count: number;
}

export interface GameSummary {
  id: string;
  title: string;
  playedAt: string;
  status: GameStatus;
}

export interface GameListItem extends GameSummary {
  participantCount: number;
  winnerName: string | null;
  createdByPlayerId: string | null;
}

export interface GameDetails extends GameSummary {
  groupId: string;
  createdByPlayerId: string | null;
  initialChips: number;
  smallBlindChips: number;
  bigBlindChips: number;
  bigBlindAnteChips: number;
  initialStackBb: number;
  rebuyChips: number;
  chipDistribution: GameChipAllocation[] | null;
  previewParticipantCount: number;
  venueCost: number;
  firstPlaceCost: number;
  secondPlaceCost: number;
  thirdPlaceCost: number;
  costShares: number[] | null;
  bbRate: number;
  settlementPlanPublishedAt: string | null;
  sevenDeuceRuleEnabled: boolean;
  bombPotRuleEnabled: boolean;
  payPayRecipientLink: string | null;
  payPayLinkRegisteredAt: string | null;
  payPayOwnerPlayerId: string | null;
  payPayOwnerDisplayName: string | null;
  payPayOwnerGroupPlayerId: string | null;
}

export interface CreateGameInput {
  title: string;
  playedAt: string;
  initialChips: number;
  smallBlindChips: number;
  bigBlindChips: number;
  bigBlindAnteChips: number;
  initialStackBb: number;
  rebuyChips: number;
  chipDistribution: GameChipAllocation[] | null;
  previewParticipantCount: number;
  venueCost: number;
  firstPlaceCost: number;
  secondPlaceCost: number;
  thirdPlaceCost: number;
  costShares: number[];
  bbRate: number;
  sevenDeuceRuleEnabled: boolean;
  bombPotRuleEnabled: boolean;
}
