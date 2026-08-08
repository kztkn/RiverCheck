import { assertNonNegativeSafeInteger } from "../shared/validation";

export const COST_ROUNDING_UNIT = 100;
export const MINIMUM_PARTICIPANT_COUNT = 4;

export interface CostShareInput {
  venueCost: number;
  participantCount: number;
  firstPlaceCost: number;
  secondPlaceCost: number;
  thirdPlaceCost: number;
}

export interface CostShareResult {
  settlementTotal: number;
  shares: number[];
}

function assertRounded(value: number, label: string): void {
  assertNonNegativeSafeInteger(value, label);
  if (value % COST_ROUNDING_UNIT !== 0) {
    throw new RangeError(`${label} must be a multiple of 100`);
  }
}

export function calculateCostShares({
  venueCost,
  participantCount,
  firstPlaceCost,
  secondPlaceCost,
  thirdPlaceCost,
}: CostShareInput): CostShareResult {
  assertNonNegativeSafeInteger(venueCost, "venueCost");
  assertNonNegativeSafeInteger(participantCount, "participantCount");
  if (participantCount < MINIMUM_PARTICIPANT_COUNT) {
    throw new RangeError("participantCount must be at least 4");
  }

  const fixedCosts = [firstPlaceCost, secondPlaceCost, thirdPlaceCost];
  fixedCosts.forEach((value, index) =>
    assertRounded(value, `${index + 1} place cost`),
  );

  if (firstPlaceCost > secondPlaceCost || secondPlaceCost > thirdPlaceCost) {
    throw new RangeError("place costs must be non-decreasing");
  }

  const settlementTotal =
    Math.ceil(venueCost / COST_ROUNDING_UNIT) * COST_ROUNDING_UNIT;
  if (!Number.isSafeInteger(settlementTotal)) {
    throw new RangeError("settlementTotal exceeds the safe integer range");
  }

  const minimumRequired =
    firstPlaceCost + secondPlaceCost + (participantCount - 2) * thirdPlaceCost;
  if (!Number.isSafeInteger(minimumRequired)) {
    throw new RangeError("minimumRequired exceeds the safe integer range");
  }
  if (minimumRequired > settlementTotal) {
    throw new RangeError("minimum required amount exceeds settlement total");
  }

  const progressiveCount = participantCount - 3;
  const weightTotal = (progressiveCount * (progressiveCount + 1)) / 2;
  const remainder = settlementTotal - minimumRequired;
  const shares = [...fixedCosts];

  for (let index = 1; index < progressiveCount; index += 1) {
    const progressiveAmount =
      Math.floor((remainder * index) / weightTotal / COST_ROUNDING_UNIT) *
      COST_ROUNDING_UNIT;
    shares.push(thirdPlaceCost + progressiveAmount);
  }

  const allocated = shares.reduce((sum, share) => sum + share, 0);
  shares.push(settlementTotal - allocated);

  return { settlementTotal, shares };
}
