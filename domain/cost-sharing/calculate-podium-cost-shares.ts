import {
  COST_ROUNDING_UNIT,
  type CostShareResult,
} from "./calculate-cost-shares";
import { assertNonNegativeSafeInteger } from "../shared/validation";

export const MINIMUM_PODIUM_PARTICIPANT_COUNT = 6;

const SECOND_PLACE_WEIGHT = 50;
const THIRD_PLACE_WEIGHT = 75;
const FOURTH_PLACE_WEIGHT = 120;
const LOWER_PLACE_WEIGHT_STEP = 5;
const MAXIMUM_LOWER_PLACE_WEIGHT = 140;

export function calculatePodiumCostShares(
  venueCost: number,
  participantCount: number,
): CostShareResult {
  assertNonNegativeSafeInteger(venueCost, "venueCost");
  assertNonNegativeSafeInteger(participantCount, "participantCount");
  if (participantCount < MINIMUM_PODIUM_PARTICIPANT_COUNT) {
    throw new RangeError("participantCount must be at least 6");
  }

  const settlementTotal =
    Math.ceil(venueCost / COST_ROUNDING_UNIT) * COST_ROUNDING_UNIT;
  if (!Number.isSafeInteger(settlementTotal)) {
    throw new RangeError("settlementTotal exceeds the safe integer range");
  }

  const weights = Array.from({ length: participantCount }, (_, index) =>
    podiumWeight(index),
  );
  const weightTotal = weights.reduce((total, weight) => total + weight, 0);
  if (!Number.isSafeInteger(weightTotal)) {
    throw new RangeError("weightTotal exceeds the safe integer range");
  }

  const totalUnits = settlementTotal / COST_ROUNDING_UNIT;
  const weightTotalBigInt = BigInt(weightTotal);
  const shares = weights.map(
    (weight) =>
      Number(
        (BigInt(totalUnits) * BigInt(weight)) / weightTotalBigInt,
      ) * COST_ROUNDING_UNIT,
  );
  let remainingUnits =
    totalUnits -
    shares.reduce(
      (total, share) => total + share / COST_ROUNDING_UNIT,
      0,
    );
  let index = participantCount - 1;

  while (remainingUnits > 0) {
    shares[index] = shares[index]! + COST_ROUNDING_UNIT;
    remainingUnits -= 1;
    index = index === 3 ? participantCount - 1 : index - 1;
  }

  return { settlementTotal, shares };
}

function podiumWeight(index: number): number {
  if (index === 0) return 0;
  if (index === 1) return SECOND_PLACE_WEIGHT;
  if (index === 2) return THIRD_PLACE_WEIGHT;
  return Math.min(
    FOURTH_PLACE_WEIGHT + (index - 3) * LOWER_PLACE_WEIGHT_STEP,
    MAXIMUM_LOWER_PLACE_WEIGHT,
  );
}
