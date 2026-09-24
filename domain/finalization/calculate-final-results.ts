import { validateChipTotal } from "../chip-validation/validate-chip-total";
import { calculateCostShares } from "../cost-sharing/calculate-cost-shares";
import { validateCostSharePlan } from "../cost-sharing/validate-cost-share-plan";
import { calculateRanking } from "../ranking/calculate-ranking";
import { calculateScore } from "../score/calculate-score";
import { calculateRoundedGameSettlements } from "../settlement/calculate-game-settlements";

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
  bigBlindChips: number;
  rebuyChips: number;
  venueCost: number;
  firstPlaceCost: number;
  secondPlaceCost: number;
  thirdPlaceCost: number;
  costShares?: number[] | null;
  bbRate?: number;
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
  const gameSettlementByPlayerId = new Map(
    calculateRoundedGameSettlements(
      ranking.map((ranked) => ({
        groupPlayerId: ranked.groupPlayerId,
        score: ranked.score,
      })),
      settings.initialChips,
      settings.bbRate ?? 0,
      settings.bigBlindChips,
    ).map((settlement) => [
      settlement.groupPlayerId,
      settlement.gameSettlementAmount,
    ]),
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
        gameSettlementAmount:
          gameSettlementByPlayerId.get(ranked.groupPlayerId) ?? 0,
      };
    }),
  };
}
