export interface GroupSummary {
  id: string;
  name: string;
  publicCode: string;
  payPayRecipientLink: string | null;
  payPayLinkRegisteredAt: string | null;
}

export interface GroupDirectoryItem {
  id: string;
  name: string;
  publicCode: string;
}
