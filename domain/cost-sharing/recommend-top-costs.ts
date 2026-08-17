import {
  calculateCostShares,
  COST_ROUNDING_UNIT,
  MINIMUM_PARTICIPANT_COUNT,
} from "./calculate-cost-shares";
import { calculateSimpleCostShares } from "./calculate-simple-cost-shares";
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

export type RecommendationMode = "standard" | "gentle" | "simple";

export function recommendTopCosts(
  venueCost: number,
  participantCount: number,
  mode: RecommendationMode = "standard",
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

  if (mode === "gentle") {
    return recommendGentleTopCosts(
      venueCost,
      participantCount,
      settlementTotal,
      weightTotal,
    );
  }

  if (mode === "simple") {
    const result = calculateSimpleCostShares(venueCost, participantCount);
    return {
      firstPlaceCost: result.shares[0]!,
      secondPlaceCost: result.shares[1]!,
      thirdPlaceCost: result.shares[2]!,
      settlementTotal: result.settlementTotal,
      shares: result.shares,
    };
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

function recommendGentleTopCosts(
  venueCost: number,
  participantCount: number,
  settlementTotal: number,
  standardWeightTotal: number,
): RecommendedTopCosts {
  const equalShare = settlementTotal / participantCount;
  const targets = Array.from({ length: participantCount }, (_, index) => {
    const standardShare =
      (settlementTotal * (index + 1)) / standardWeightTotal;
    return (equalShare * 2 + standardShare) / 3;
  });
  const candidates = targets.slice(0, 3).map(buildNearbyCandidates);
  let best:
    | {
        firstPlaceCost: number;
        secondPlaceCost: number;
        thirdPlaceCost: number;
        result: ReturnType<typeof calculateCostShares>;
        score: number;
      }
    | undefined;

  for (const firstPlaceCost of candidates[0]!) {
    for (const secondPlaceCost of candidates[1]!) {
      if (secondPlaceCost < firstPlaceCost) continue;
      for (const thirdPlaceCost of candidates[2]!) {
        if (thirdPlaceCost < secondPlaceCost) continue;
        try {
          const result = calculateCostShares({
            venueCost,
            participantCount,
            firstPlaceCost,
            secondPlaceCost,
            thirdPlaceCost,
          });
          if (!isNonDecreasing(result.shares)) continue;
          const score = result.shares.reduce((total, share, index) => {
            const difference =
              (share - targets[index]!) / COST_ROUNDING_UNIT;
            return total + difference * difference;
          }, 0);
          if (!best || score < best.score) {
            best = {
              firstPlaceCost,
              secondPlaceCost,
              thirdPlaceCost,
              result,
              score,
            };
          }
        } catch {
          continue;
        }
      }
    }
  }

  if (!best) throw new RangeError("gentle recommendation is unavailable");
  return {
    firstPlaceCost: best.firstPlaceCost,
    secondPlaceCost: best.secondPlaceCost,
    thirdPlaceCost: best.thirdPlaceCost,
    settlementTotal: best.result.settlementTotal,
    shares: best.result.shares,
  };
}

function buildNearbyCandidates(target: number): number[] {
  const center =
    Math.round(target / COST_ROUNDING_UNIT) * COST_ROUNDING_UNIT;
  const candidates = new Set<number>();
  for (let offset = -5; offset <= 5; offset += 1) {
    const candidate = center + offset * COST_ROUNDING_UNIT;
    if (candidate >= 0 && Number.isSafeInteger(candidate)) {
      candidates.add(candidate);
    }
  }
  return [...candidates].sort((left, right) => left - right);
}

function isNonDecreasing(values: number[]): boolean {
  return values.every(
    (value, index) => index === 0 || value >= values[index - 1]!,
  );
}

export function recommendTopCostsForAttendance(
  venueCost: number,
  intendedParticipantCount: number,
  actualParticipantCount: number,
  mode: RecommendationMode = "standard",
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
    ...recommendTopCosts(venueCost, participantCount, mode),
    participantCount,
    adjustedToAttendance: actualParticipantCount > intendedParticipantCount,
  };
}
