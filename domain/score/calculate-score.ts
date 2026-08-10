import { assertNonNegativeSafeInteger } from "../shared/validation";

export interface ScoreInput {
  remainingChips: number;
  settlementRebuyCount: number;
  rebuyChips: number;
}

export function calculateScore({
  remainingChips,
  settlementRebuyCount,
  rebuyChips,
}: ScoreInput): number {
  assertNonNegativeSafeInteger(remainingChips, "remainingChips");
  assertNonNegativeSafeInteger(
    settlementRebuyCount,
    "settlementRebuyCount",
  );
  assertNonNegativeSafeInteger(rebuyChips, "rebuyChips");

  const score = remainingChips - settlementRebuyCount * rebuyChips;
  if (!Number.isSafeInteger(score)) {
    throw new RangeError("score exceeds the safe integer range");
  }

  return score;
}
