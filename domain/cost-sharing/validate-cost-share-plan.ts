import {
  COST_ROUNDING_UNIT,
  MINIMUM_PARTICIPANT_COUNT,
  type CostShareResult,
} from "./calculate-cost-shares";
import { assertNonNegativeSafeInteger } from "../shared/validation";

export interface CostSharePlanInput {
  venueCost: number;
  participantCount: number;
  shares: number[];
}

export function validateCostSharePlan({
  venueCost,
  participantCount,
  shares,
}: CostSharePlanInput): CostShareResult {
  assertNonNegativeSafeInteger(venueCost, "venueCost");
  assertNonNegativeSafeInteger(participantCount, "participantCount");
  if (participantCount < MINIMUM_PARTICIPANT_COUNT) {
    throw new RangeError("participantCount must be at least 4");
  }
  if (shares.length !== participantCount) {
    throw new RangeError("cost share count must match participantCount");
  }

  shares.forEach((share, index) => {
    assertNonNegativeSafeInteger(share, `${index + 1} place cost`);
    if (share % COST_ROUNDING_UNIT !== 0) {
      throw new RangeError(`${index + 1} place cost must be a multiple of 100`);
    }
    if (index > 0 && share < shares[index - 1]!) {
      throw new RangeError("place costs must be non-decreasing");
    }
  });

  const settlementTotal =
    Math.ceil(venueCost / COST_ROUNDING_UNIT) * COST_ROUNDING_UNIT;
  if (!Number.isSafeInteger(settlementTotal)) {
    throw new RangeError("settlementTotal exceeds the safe integer range");
  }
  const allocatedTotal = shares.reduce((total, share) => {
    const next = total + share;
    if (!Number.isSafeInteger(next)) {
      throw new RangeError("allocatedTotal exceeds the safe integer range");
    }
    return next;
  }, 0);
  if (allocatedTotal !== settlementTotal) {
    throw new RangeError("cost share total must match settlementTotal");
  }

  return {
    settlementTotal,
    shares: [...shares],
  };
}
