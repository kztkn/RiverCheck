import {
  calculateCostShares,
  COST_ROUNDING_UNIT,
  MINIMUM_PARTICIPANT_COUNT,
} from "./calculate-cost-shares";
import { assertNonNegativeSafeInteger } from "../shared/validation";

export interface RecommendedTopCosts {
  firstPlaceCost: number;
  secondPlaceCost: number;
  thirdPlaceCost: number;
  settlementTotal: number;
  shares: number[];
}

export interface AttendanceAdjustedRecommendation extends RecommendedTopCosts {
  participantCount: number;
  adjustedToAttendance: boolean;
}

export function recommendTopCosts(
  venueCost: number,
  participantCount: number,
): RecommendedTopCosts {
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

  const weightTotal = (participantCount * (participantCount + 1)) / 2;
  if (!Number.isSafeInteger(weightTotal)) {
    throw new RangeError("weightTotal exceeds the safe integer range");
  }

  const recommended = [1, 2, 3].map(
    (rank) =>
      Math.floor(
        ((settlementTotal / weightTotal) * rank) / COST_ROUNDING_UNIT,
      ) * COST_ROUNDING_UNIT,
  );
  const [firstPlaceCost, secondPlaceCost, thirdPlaceCost] = recommended as [
    number,
    number,
    number,
  ];
  const result = calculateCostShares({
    venueCost,
    participantCount,
    firstPlaceCost,
    secondPlaceCost,
    thirdPlaceCost,
  });

  return {
    firstPlaceCost,
    secondPlaceCost,
    thirdPlaceCost,
    settlementTotal: result.settlementTotal,
    shares: result.shares,
  };
}

export function recommendTopCostsForAttendance(
  venueCost: number,
  intendedParticipantCount: number,
  actualParticipantCount: number,
): AttendanceAdjustedRecommendation {
  assertNonNegativeSafeInteger(
    intendedParticipantCount,
    "intendedParticipantCount",
  );
  assertNonNegativeSafeInteger(actualParticipantCount, "actualParticipantCount");
  const participantCount = Math.max(
    MINIMUM_PARTICIPANT_COUNT,
    intendedParticipantCount,
    actualParticipantCount,
  );

  return {
    ...recommendTopCosts(venueCost, participantCount),
    participantCount,
    adjustedToAttendance: actualParticipantCount > intendedParticipantCount,
  };
}
