import { validateChipTotal } from "../chip-validation/validate-chip-total";
import { calculateCostShares } from "../cost-sharing/calculate-cost-shares";
import { calculateRanking } from "../ranking/calculate-ranking";
import { calculateScore } from "../score/calculate-score";

export interface FinalizationParticipant {
  groupPlayerId: string;
  displayName: string;
  remainingChips: number;
  rebuyCount: number;
}

export interface FinalizationSettings {
  initialChips: number;
  rebuyChips: number;
  venueCost: number;
  firstPlaceCost: number;
  secondPlaceCost: number;
  thirdPlaceCost: number;
}

export function calculateFinalResults(
  settings: FinalizationSettings,
  participants: FinalizationParticipant[],
) {
  const chipValidation = validateChipTotal({
    initialChips: settings.initialChips,
    rebuyChips: settings.rebuyChips,
    reports: participants.map(({ remainingChips, rebuyCount }) => ({
      remainingChips,
      rebuyCount,
    })),
  });
  const costShares = calculateCostShares({
    venueCost: settings.venueCost,
    participantCount: participants.length,
    firstPlaceCost: settings.firstPlaceCost,
    secondPlaceCost: settings.secondPlaceCost,
    thirdPlaceCost: settings.thirdPlaceCost,
  });
  const participantById = new Map(
    participants.map((participant) => [participant.groupPlayerId, participant]),
  );
  const ranking = calculateRanking(
    participants.map((participant) => ({
      groupPlayerId: participant.groupPlayerId,
      rebuyCount: participant.rebuyCount,
      score: calculateScore({
        remainingChips: participant.remainingChips,
        rebuyCount: participant.rebuyCount,
        rebuyChips: settings.rebuyChips,
      }),
    })),
  );

  return {
    chipValidation,
    settlementTotal: costShares.settlementTotal,
    results: ranking.map((ranked) => {
      const participant = participantById.get(ranked.groupPlayerId);
      if (!participant) throw new Error("ranked participant is missing");
      return {
        ...participant,
        score: ranked.score,
        rank: ranked.rank,
        costShare: costShares.shares[ranked.rank - 1]!,
      };
    }),
  };
}
