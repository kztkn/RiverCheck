import { withTransaction } from "@server/db/client.server";
import { calculateSettlementBalance } from "@domain/settlement/calculate-game-settlements";
import {
  lockCostShareForReceipt,
  setGameCostShareReceived,
} from "@server/repositories/game-cost-share-receipt-repository.server";

export async function updateGameCostShareReceipt(
  groupId: string,
  gameId: string,
  groupPlayerId: string,
  received: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    return await withTransaction(async (transaction) => {
      const settlement = await lockCostShareForReceipt(
        transaction,
        groupId,
        gameId,
        groupPlayerId,
      );
      if (settlement === null) {
        return {
          ok: false,
          error: "会費の回収対象を確認できませんでした。画面を更新してください。",
        };
      }
      const balance = calculateSettlementBalance({
        costShare: settlement.costShare,
        gameSettlementAmount: settlement.gameSettlementAmount ?? 0,
      });
      if (received && balance === 0) {
        return {
          ok: false,
          error:
            (settlement.gameSettlementAmount ?? 0) === 0
              ? "0円の参加者は回収対象外です。"
              : "0円の参加者は精算対象外です。",
        };
      }

      await setGameCostShareReceived(
        transaction,
        gameId,
        groupPlayerId,
        received,
      );
      return { ok: true };
    });
  } catch (error) {
    console.error("Failed to update game cost share receipt", {
      errorType: error instanceof Error ? error.name : "unknown",
      gameId,
    });
    return {
      ok: false,
      error: "会費の回収状況を保存できませんでした。時間をおいて再度お試しください。",
    };
  }
}
