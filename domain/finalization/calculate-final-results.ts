import { validateChipTotal } from "../chip-validation/validate-chip-total";
import { calculateCostShares } from "../cost-sharing/calculate-cost-shares";
import { validateCostSharePlan } from "../cost-sharing/validate-cost-share-plan";
import { calculateRanking } from "../ranking/calculate-ranking";
import { calculateScore } from "../score/calculate-score";

export interface FinalizationParticipant {
  groupPlayerId: string;
  displayName: string;
  remainingChips: number;
  totalRebuyCount: number | null;
  outstandingRebuyCount: number;
  settlementRebuyCount: number;
}

export interface FinalizationSettings {
  initialChips: number;
  rebuyChips: number;
  venueCost: number;
  firstPlaceCost: number;
  secondPlaceCost: number;
  thirdPlaceCost: number;
  costShares?: number[] | null;
}

export function calculateFinalResults(
  settings: FinalizationSettings,
  participants: FinalizationParticipant[],
) {
  const chipValidation = validateChipTotal({
    initialChips: settings.initialChips,
    rebuyChips: settings.rebuyChips,
    reports: participants.map(({ remainingChips, settlementRebuyCount }) => ({
      remainingChips,
      settlementRebuyCount,
    })),
  });
  const costShares = settings.costShares
    ? validateCostSharePlan({
        venueCost: settings.venueCost,
        participantCount: participants.length,
        shares: settings.costShares,
      })
    : calculateCostShares({
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
      totalRebuyCount:
        participant.totalRebuyCount ?? participant.settlementRebuyCount,
      score: calculateScore({
        remainingChips: participant.remainingChips,
        settlementRebuyCount: participant.settlementRebuyCount,
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
        groupPlayerId: participant.groupPlayerId,
        displayName: participant.displayName,
        remainingChips: participant.remainingChips,
        totalRebuyCount: participant.totalRebuyCount,
        trackedOutstandingRebuyCount: participant.outstandingRebuyCount,
        settlementRebuyCount: participant.settlementRebuyCount,
        score: ranked.score,
        rank: ranked.rank,
        costShare: costShares.shares[ranked.rank - 1]!,
      };
    }),
  };
}
