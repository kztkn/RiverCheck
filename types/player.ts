export interface GroupPlayerSummary {
  id: string;
  displayName: string;
  isActive: boolean;
}

export interface GameParticipantSummary {
  id: string;
  groupPlayerId: string;
  displayName: string;
  status: "joined" | "submitted" | "locked";
  remainingChips: number | null;
  rebuyCount: number;
  deviceLocked: boolean;
}

export interface RegisteredPlayerOption {
  id: string;
  displayName: string;
  deviceLocked: boolean;
}
