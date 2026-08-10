import { withTransaction } from "@server/db/client.server";
import {
  insertFinalResults,
  insertResultRevision,
  lockGameForFinalization,
  lockFinalResults,
  lockParticipantsForFinalization,
  markGameFinalized,
  saveCostSettingsForFinalization,
  replaceFinalResults,
  toFinalizationParticipants,
  updateParticipantsForCorrection,
  updateFinalizedGameIdentity,
} from "@server/repositories/finalization-repository.server";
import { calculateFinalResults } from "@domain/finalization/calculate-final-results";
import { validateChipTotal } from "@domain/chip-validation/validate-chip-total";
import {
  buildResultRevisionChanges,
  hasResultInputChanges,
} from "@domain/result-revision/build-result-revision-changes";
import type { CreateGameInput, GameDetails } from "@shared-types/game";
import type { GameParticipantSummary } from "@shared-types/player";
import { awardAchievementsForPlayers } from "@server/services/achievement-service.server";

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
    participants.length > 0
      ? validateChipTotal({
          initialChips: game.initialChips,
          rebuyChips: game.rebuyChips,
          reports: participants.map((participant) => ({
            remainingChips: participant.remainingChips ?? 0,
            rebuyCount:
              participant.remainingChips === null ? 0 : participant.rebuyCount,
          })),
        })
      : null;

  return {
    participantCount: participants.length,
    submittedCount: completeParticipants.length,
    incompleteNames,
    isProvisional: incompleteNames.length > 0,
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
    if (settings.previewParticipantCount !== rows.length) {
      return {
        ok: false,
        error: `会費精算の人数（${settings.previewParticipantCount}人）と参加者（${rows.length}人）を一致させてください。`,
      };
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
    await awardAchievementsForPlayers(
      transaction,
      groupId,
      calculated.results.map((result) => result.groupPlayerId),
    );
    return { ok: true };
  });
}

export interface ResultCorrectionInput {
  groupPlayerId: string;
  remainingChips: number;
  rebuyCount: number;
}

export async function updateFinalizedGame(
  groupId: string,
  gameId: string,
  corrections: ResultCorrectionInput[],
  identity: { title: string; playedAt: string },
  differenceConfirmed: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return withTransaction(async (transaction) => {
    const game = await lockGameForFinalization(transaction, groupId, gameId);
    if (!game) return { ok: false, error: "開催が見つかりません。" };
    if (game.status !== "finalized") {
      return {
        ok: false,
        error: "確定済みの開催だけ結果を訂正できます。",
      };
    }

    if (
      corrections.some(
        (correction) =>
          !Number.isSafeInteger(correction.remainingChips) ||
          correction.remainingChips < 0 ||
          !Number.isSafeInteger(correction.rebuyCount) ||
          correction.rebuyCount < 0,
      )
    ) {
      return {
        ok: false,
        error: "残りチップとリバイ回数は0以上の整数で入力してください。",
      };
    }

    const beforeResults = await lockFinalResults(transaction, gameId);
    const correctionByPlayerId = new Map(
      corrections.map((correction) => [
        correction.groupPlayerId,
        correction,
      ]),
    );
    if (
      beforeResults.length < 4 ||
      beforeResults.length !== corrections.length ||
      beforeResults.length !== correctionByPlayerId.size ||
      beforeResults.some(
        (result) => !correctionByPlayerId.has(result.groupPlayerId),
      )
    ) {
      return {
        ok: false,
        error:
          "確定時から参加者情報が変わっています。画面を更新して確認してください。",
      };
    }

    const identityChanged =
      game.title !== identity.title || game.playedAt !== identity.playedAt;
    const resultInputsChanged = hasResultInputChanges(
      beforeResults,
      corrections,
    );
    if (!resultInputsChanged && !identityChanged) {
      return { ok: false, error: "変更された入力がありません。" };
    }

    if (!resultInputsChanged) {
      if (
        !(await updateFinalizedGameIdentity(
          transaction,
          groupId,
          gameId,
          identity,
        ))
      ) {
        throw new Error("game status changed during identity update");
      }
      await awardAchievementsForPlayers(
        transaction,
        groupId,
        beforeResults.map((result) => result.groupPlayerId),
      );
      return { ok: true };
    }

    const rows = await lockParticipantsForFinalization(transaction, gameId);
    if (
      rows.length !== beforeResults.length ||
      rows.some((row) => !correctionByPlayerId.has(row.group_player_id))
    ) {
      return {
        ok: false,
        error:
          "確定時から参加者情報が変わっています。画面を更新して確認してください。",
      };
    }

    const participants = rows.map((row) => {
      const correction = correctionByPlayerId.get(row.group_player_id);
      if (!correction) {
        throw new Error("correction participant is missing");
      }
      return {
        groupPlayerId: row.group_player_id,
        displayName: row.display_name,
        remainingChips: correction.remainingChips,
        rebuyCount: correction.rebuyCount,
      };
    });

    let calculated;
    try {
      calculated = calculateFinalResults(game, participants);
    } catch {
      return {
        ok: false,
        error: "入力内容から訂正結果を計算できません。",
      };
    }

    const resultChanges = buildResultRevisionChanges(
      beforeResults,
      calculated.results,
    );
    if (resultChanges.length === 0) {
      return { ok: false, error: "変更された入力がありません。" };
    }
    if (!calculated.chipValidation.isValid && !differenceConfirmed) {
      return {
        ok: false,
        error: "チップ差分を確認してから訂正してください。",
      };
    }

    await insertResultRevision(
      transaction,
      gameId,
      beforeResults,
      calculated.results,
    );
    await updateParticipantsForCorrection(transaction, gameId, participants);
    await replaceFinalResults(transaction, gameId, calculated.results);

    if (
      identityChanged &&
      !(await updateFinalizedGameIdentity(
        transaction,
        groupId,
        gameId,
        identity,
      ))
    ) {
      throw new Error("game status changed during result correction");
    }
    await awardAchievementsForPlayers(
      transaction,
      groupId,
      calculated.results.map((result) => result.groupPlayerId),
    );
    return { ok: true };
  });
}
