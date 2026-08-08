import { withTransaction } from "@server/db/client.server";
import {
  insertFinalResults,
  lockGameForFinalization,
  lockParticipantsForFinalization,
  markGameFinalized,
  saveCostSettingsForFinalization,
  toFinalizationParticipants,
} from "@server/repositories/finalization-repository.server";
import { calculateFinalResults } from "@domain/finalization/calculate-final-results";
import { validateChipTotal } from "@domain/chip-validation/validate-chip-total";
import type { CreateGameInput, GameDetails } from "@shared-types/game";
import type { GameParticipantSummary } from "@shared-types/player";

export function buildFinalizationState(
  game: GameDetails,
  participants: GameParticipantSummary[],
) {
  const incompleteNames = participants
    .filter((participant) => participant.remainingChips === null)
    .map((participant) => participant.displayName);
  const completeParticipants = participants.filter(
    (participant) => participant.remainingChips !== null,
  );
  const chipValidation =
    incompleteNames.length === 0 && participants.length > 0
      ? validateChipTotal({
          initialChips: game.initialChips,
          rebuyChips: game.rebuyChips,
          reports: completeParticipants.map((participant) => ({
            remainingChips: participant.remainingChips!,
            rebuyCount: participant.rebuyCount,
          })),
        })
      : null;

  return {
    participantCount: participants.length,
    submittedCount: completeParticipants.length,
    incompleteNames,
    chipValidation,
    canFinalize:
      game.status === "open" &&
      participants.length >= 4 &&
      incompleteNames.length === 0,
  };
}

export async function finalizeGame(
  groupId: string,
  gameId: string,
  settings: CreateGameInput,
  differenceConfirmed: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return withTransaction(async (transaction) => {
    const game = await lockGameForFinalization(transaction, groupId, gameId);
    if (!game) return { ok: false, error: "開催が見つかりません。" };
    if (game.status === "finalized") {
      return { ok: false, error: "この開催はすでに確定済みです。" };
    }
    if (game.status !== "open") {
      return { ok: false, error: "受付中の開催だけ確定できます。" };
    }

    const rows = await lockParticipantsForFinalization(transaction, gameId);
    if (rows.length < 4) {
      return { ok: false, error: "結果確定には4人以上の参加者が必要です。" };
    }
    const participants = toFinalizationParticipants(rows);
    if (participants.some((participant) => participant === null)) {
      return { ok: false, error: "未入力の参加者がいます。" };
    }

    let calculated;
    try {
      calculated = calculateFinalResults(
        {
          ...game,
          venueCost: settings.venueCost,
          firstPlaceCost: settings.firstPlaceCost,
          secondPlaceCost: settings.secondPlaceCost,
          thirdPlaceCost: settings.thirdPlaceCost,
        },
        participants.filter(
          (participant): participant is NonNullable<typeof participant> =>
            participant !== null,
        ),
      );
    } catch {
      return {
        ok: false,
        error: "現在の参加人数と開催条件では精算を確定できません。",
      };
    }

    if (!calculated.chipValidation.isValid && !differenceConfirmed) {
      return {
        ok: false,
        error: "チップ差分を確認してから確定してください。",
      };
    }

    if (
      !(await saveCostSettingsForFinalization(
        transaction,
        groupId,
        gameId,
        settings,
      ))
    ) {
      throw new Error("game settings changed during finalization");
    }
    await insertFinalResults(transaction, gameId, calculated.results);
    if (!(await markGameFinalized(transaction, groupId, gameId))) {
      throw new Error("game status changed during finalization");
    }
    return { ok: true };
  });
}
