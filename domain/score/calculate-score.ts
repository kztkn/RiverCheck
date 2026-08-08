import { assertNonNegativeSafeInteger } from "../shared/validation";

export interface ScoreInput {
  remainingChips: number;
  rebuyCount: number;
  rebuyChips: number;
}

export function calculateScore({
  remainingChips,
  rebuyCount,
  rebuyChips,
}: ScoreInput): number {
  assertNonNegativeSafeInteger(remainingChips, "remainingChips");
  assertNonNegativeSafeInteger(rebuyCount, "rebuyCount");
  assertNonNegativeSafeInteger(rebuyChips, "rebuyChips");

  const score = remainingChips - rebuyCount * rebuyChips;
  if (!Number.isSafeInteger(score)) {
    throw new RangeError("score exceeds the safe integer range");
  }

  return score;
}
