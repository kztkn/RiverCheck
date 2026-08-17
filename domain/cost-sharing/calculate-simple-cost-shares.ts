import {
  COST_ROUNDING_UNIT,
  MINIMUM_PARTICIPANT_COUNT,
  type CostShareResult,
} from "./calculate-cost-shares";
import { assertNonNegativeSafeInteger } from "../shared/validation";

export function calculateSimpleCostShares(
  venueCost: number,
  participantCount: number,
): CostShareResult {
  assertNonNegativeSafeInteger(venueCost, "venueCost");
  assertNonNegativeSafeInteger(participantCount, "participantCount");
  if (participantCount < MINIMUM_PARTICIPANT_COUNT) {
    throw new RangeError("participantCount must be at least 4");
  }

  const settlementTotal =
    Math.ceil(venueCost / COST_ROUNDING_UNIT) * COST_ROUNDING_UNIT;
  if (!Number.isSafeInteger(settlementTotal)) {
    throw new RangeError("settlementTotal exceeds the safe integer range");
  }

  const totalUnits = settlementTotal / COST_ROUNDING_UNIT;
  const commonShare =
    Math.ceil(totalUnits / participantCount) * COST_ROUNDING_UNIT;
  const shares = Array<number>(participantCount).fill(0);
  let remaining = settlementTotal;

  for (let index = participantCount - 1; index >= 0; index -= 1) {
    const share = Math.min(commonShare, remaining);
    shares[index] = share;
    remaining -= share;
  }

  return { settlementTotal, shares };
}
