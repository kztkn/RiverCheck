import { assertNonNegativeSafeInteger } from "../shared/validation";

export interface RankingEntry {
  groupPlayerId: string;
  score: number;
  rebuyCount: number;
}

export interface RankedEntry extends RankingEntry {
  rank: number;
}

export function calculateRanking(entries: RankingEntry[]): RankedEntry[] {
  const validated = entries.map((entry) => {
    if (!entry.groupPlayerId) {
      throw new TypeError("groupPlayerId is required");
    }
    if (!Number.isSafeInteger(entry.score)) {
      throw new RangeError("score must be a safe integer");
    }
    assertNonNegativeSafeInteger(entry.rebuyCount, "rebuyCount");
    return { ...entry };
  });

  return validated
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.rebuyCount - b.rebuyCount ||
        a.groupPlayerId.localeCompare(b.groupPlayerId),
    )
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}
