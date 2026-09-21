import { calculateSettlementBalance } from "../settlement/calculate-game-settlements";

export function findChangedCostSharePlayerIds(
  before: Array<{ groupPlayerId: string; costShare: number }>,
  after: Array<{ groupPlayerId: string; costShare: number }>,
): string[] {
  const afterByPlayerId = new Map(
    after.map((result) => [result.groupPlayerId, result.costShare]),
  );
  return before
    .filter(
      (result) => afterByPlayerId.get(result.groupPlayerId) !== result.costShare,
    )
    .map((result) => result.groupPlayerId);
}

export function findChangedSettlementPlayerIds(
  before: Array<{
    groupPlayerId: string;
    costShare: number;
    gameSettlementAmount?: number;
  }>,
  after: Array<{
    groupPlayerId: string;
    costShare: number;
    gameSettlementAmount?: number;
  }>,
): string[] {
  const afterByPlayerId = new Map(
    after.map((result) => [
      result.groupPlayerId,
      calculateSettlementBalance({
        costShare: result.costShare,
        gameSettlementAmount: result.gameSettlementAmount ?? 0,
      }),
    ]),
  );
  return before
    .filter(
      (result) =>
        afterByPlayerId.get(result.groupPlayerId) !==
        calculateSettlementBalance({
          costShare: result.costShare,
          gameSettlementAmount: result.gameSettlementAmount ?? 0,
        }),
    )
    .map((result) => result.groupPlayerId);
}
