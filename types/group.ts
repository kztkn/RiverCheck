export interface GroupSummary {
  id: string;
  name: string;
  publicCode: string;
  lineOpenChatUrl: string | null;
  payPayRecipientLink: string | null;
  payPayLinkRegisteredAt: string | null;
  payPayOwnerPlayerId: string | null;
  payPayOwnerDisplayName: string | null;
}

export interface GroupDirectoryItem {
  id: string;
  name: string;
  publicCode: string;
}
