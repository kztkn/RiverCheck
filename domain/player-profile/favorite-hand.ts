export const POKER_RANKS = [
  "A",
  "K",
  "Q",
  "J",
  "T",
  "9",
  "8",
  "7",
  "6",
  "5",
  "4",
  "3",
  "2",
] as const;

export const POKER_SUITS = ["S", "H", "D", "C"] as const;

export type PokerRank = (typeof POKER_RANKS)[number];
export type PokerSuit = (typeof POKER_SUITS)[number];
export type PokerCardCode = `${PokerRank}${PokerSuit}`;

export function isPokerCardCode(value: string): value is PokerCardCode {
  return /^[AKQJT2-9][SHDC]$/u.test(value);
}

export function parsePokerCardCode(
  value: string | null,
): { code: PokerCardCode; rank: PokerRank; suit: PokerSuit } | null {
  if (!value || !isPokerCardCode(value)) return null;
  return {
    code: value,
    rank: value[0] as PokerRank,
    suit: value[1] as PokerSuit,
  };
}

export function formatPokerRank(rank: PokerRank): string {
  return rank === "T" ? "10" : rank;
}
