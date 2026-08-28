import { GroupSiteHeader } from "~/components/site-menu";
import { consumeCompletedFetcherSubmission } from "~/utils/consume-completed-fetcher-submission";
import { IconPencil, IconTrash } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import {
  Form,
  Link,
  redirect,
  useFetcher,
  useNavigation,
  useRevalidator,
} from "react-router";
import {
  findGameForGroup,
  updateLocalRules,
} from "@server/repositories/game-repository.server";
import { findGroupByPublicCode } from "@server/repositories/group-repository.server";
import {
  findParticipantByTokenHash,
  listGameParticipants,
  removeParticipant,
  updateParticipantInputByGroupPlayerId,
} from "@server/repositories/participant-repository.server";
import {
  clearParticipantCookie,
  readParticipantToken,
} from "@server/services/participant-session.server";
import { hashToken } from "@server/services/token.server";
import { requireOrganizer } from "@server/services/organizer-auth.server";
import {
  adjustOrganizerRebuyState,
  recordOrganizerRebuyAction,
  undoOrganizerRebuyAction,
  type RebuyServiceResult,
} from "@server/services/rebuy-service.server";
import {
  removeOpenGameForGroup,
  renameOpenGameForGroup,
  type GameSettingsFormValues,
  validateGameSettingsForm,
} from "@server/services/game-service.server";
import { GAME_TITLE_MAX_LENGTH } from "@domain/game/game-title";
import {
  buildFinalizationState,
  finalizeGame,
} from "@server/services/finalization-service.server";
import { calculateCostShares } from "@domain/cost-sharing/calculate-cost-shares";
import { GameSettingsFields } from "../components/game-settings-fields";
import { ParticipantLinkQr } from "../components/participant-link-qr";
import type { GameParticipantSummary } from "@shared-types/player";
import type { Route } from "./+types/game-admin";
import { createCommandId } from "~/utils/create-command-id";
import {
  getAdminParticipantInputState,
  summarizeAdminParticipantStates,
} from "~/utils/admin-participant-state";

type OrganizerRebuyIntent =
  | "record-rebuy"
  | "record-repayment"
  | "undo-rebuy"
  | "adjust-rebuy";
type OrganizerRebuyActionData = RebuyServiceResult & {
  intent: OrganizerRebuyIntent;
  participantId: string;
};
type OrganizerParticipantInputActionData =
  | {
      ok: true;
      intent: "save-participant-input";
      participantId: string;
    }
  | {
      ok: false;
      intent: "save-participant-input";
      participantId: string;
      error: string;
    };

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireOrganizer(request, params.groupCode);
  const authorized = await requireGame(params.groupCode, params.gameId);
  if (authorized.game.status === "finalized") {
    throw redirect(
      "/g/" + params.groupCode + "/games/" + params.gameId,
    );
  }
  const participantToken = readParticipantToken(request, params.gameId);
  const participantTokenHash = participantToken
    ? await hashToken(participantToken)
    : null;
  const [participants, currentParticipant] = await Promise.all([
    listGameParticipants(authorized.group.id, params.gameId),
    participantTokenHash
      ? findParticipantByTokenHash(
        authorized.group.id,
        params.gameId,
        participantTokenHash,
      )
      : Promise.resolve(null),
  ]);
  const url = new URL(request.url);
  const payload = {
    group: {
      name: authorized.group.name,
      publicCode: authorized.group.publicCode,
    },
    game: authorized.game,
    participants,
    currentParticipant: currentParticipant
      ? { displayName: currentParticipant.displayName }
      : null,
    finalization: buildFinalizationState(authorized.game, participants),
    participantUrl: `${url.origin}/g/${params.groupCode}/games/${params.gameId}`,
    notice: url.searchParams.get("notice"),
  };

  return payload;
}

export async function action({ request, params }: Route.ActionArgs) {
  await requireOrganizer(request, params.groupCode);
  const authorized = await requireGame(params.groupCode, params.gameId);
  const formData = await request.formData();
  const intent = readString(formData, "intent");

  if (intent === "finalize") {
    const values = readAdminCostSettingsForm(formData, authorized.game);
    const validation = validateGameSettingsForm(values);
    if (!validation.ok) {
      const messages = [
        ...new Set(
          Object.values(validation.errors).filter(
            (message): message is string => Boolean(message),
          ),
        ),
      ];
      return {
        ok: false as const,
        error: `精算設定を確認してください。${messages.join(" ")}`,
        errors: validation.errors,
        values,
      };
    }
    const result = await finalizeGame(
      authorized.group,
      params.gameId,
      validation.input,
      readString(formData, "confirmDifference") === "yes",
      readString(formData, "confirmRebuyMismatch") === "yes",
    );
    if (!result.ok) return { ...result, values };
    return redirect(
      "/g/" + params.groupCode + "/games/" + params.gameId + "?notice=finalized",
    );
  }

  if (intent === "save-local-rules") {
    const updated = await updateLocalRules(
      authorized.group.id,
      params.gameId,
      {
        sevenDeuceRuleEnabled:
          readString(formData, "sevenDeuceRuleEnabled") === "yes",
        bombPotRuleEnabled:
          readString(formData, "bombPotRuleEnabled") === "yes",
      },
    );
    if (!updated) {
      return {
        ok: false as const,
        intent: "save-local-rules" as const,
        error: "ローカルルールを保存できませんでした。画面を更新してください。",
      };
    }
    return redirect(
      `/g/${params.groupCode}/games/${params.gameId}/admin?notice=local-rules-saved`,
    );
  }

  if (intent === "rename-game") {
    const title = readString(formData, "title");
    try {
      const result = await renameOpenGameForGroup(
        authorized.group.id,
        params.gameId,
        title,
      );
      if (!result.ok) {
        return {
          ...result,
          intent: "rename-game" as const,
          title,
        };
      }
    } catch (error) {
      console.error("Failed to rename open game", error);
      return {
        ok: false as const,
        intent: "rename-game" as const,
        error:
          "開催名を変更できませんでした。画面を更新してもう一度お試しください。",
        title,
      };
    }
    return redirect(
      `/g/${params.groupCode}/games/${params.gameId}/admin?notice=game-renamed`,
      { status: 303 },
    );
  }

  if (intent === "delete-game") {
    try {
      const result = await removeOpenGameForGroup(
        authorized.group.id,
        params.gameId,
      );
      if (!result.ok) {
        return { ...result, intent: "delete-game" as const };
      }
    } catch (error) {
      console.error("Failed to delete open game", error);
      return {
        ok: false as const,
        intent: "delete-game" as const,
        error:
          "開催を削除できませんでした。画面を更新してもう一度お試しください。",
      };
    }
    return redirect(`/g/${params.groupCode}/manage?notice=game-deleted`, {
      status: 303,
      headers: {
        "Set-Cookie": clearParticipantCookie(
          request,
          params.groupCode,
          params.gameId,
        ),
      },
    });
  }

  const participantId = readString(formData, "participantId");
  if (!isUuid(participantId)) {
    throw new Response("Invalid participant", { status: 400 });
  }

  if (intent === "save-participant-input") {
    const groupPlayerId = readString(formData, "groupPlayerId");
    const remainingChips = parseNonNegativeInteger(
      readString(formData, "remainingChips"),
    );
    const settlementRebuyCount = parseNonNegativeInteger(
      readString(formData, "settlementRebuyCount"),
    );
    if (
      !isUuid(groupPlayerId) ||
      remainingChips === null ||
      settlementRebuyCount === null
    ) {
      return {
        ok: false as const,
        intent,
        participantId,
        error: "最終スタックと手元のリバイ証を0以上の整数で入力してください。",
      };
    }
    const updated = await updateParticipantInputByGroupPlayerId(
      authorized.group.id,
      params.gameId,
      groupPlayerId,
      remainingChips,
      settlementRebuyCount,
    );
    return updated
      ? { ok: true as const, intent, participantId }
      : {
          ok: false as const,
          intent,
          participantId,
          error: "終了入力を保存できませんでした。画面を更新してお試しください。",
        };
  }

  if (intent === "record-rebuy" || intent === "record-repayment") {
    const result = await recordOrganizerRebuyAction({
      actionType: intent === "record-rebuy" ? "rebuy" : "repayment",
      commandId: readString(formData, "commandId"),
      gameId: params.gameId,
      groupId: authorized.group.id,
      participantId,
    });
    return { ...result, intent, participantId };
  }

  if (intent === "undo-rebuy") {
    const result = await undoOrganizerRebuyAction({
      commandId: readString(formData, "commandId"),
      eventId: readString(formData, "eventId"),
      gameId: params.gameId,
      groupId: authorized.group.id,
      participantId,
    });
    return { ...result, intent, participantId };
  }

  if (intent === "adjust-rebuy") {
    const totalRebuyCount = parseNonNegativeInteger(
      readString(formData, "totalRebuyCount"),
    );
    const outstandingRebuyCount = parseNonNegativeInteger(
      readString(formData, "outstandingRebuyCount"),
    );
    const settlementValue = readString(formData, "settlementRebuyCount");
    const settlementRebuyCount = settlementValue
      ? parseNonNegativeInteger(settlementValue)
      : null;
    if (
      totalRebuyCount === null ||
      outstandingRebuyCount === null ||
      (settlementValue && settlementRebuyCount === null)
    ) {
      return {
        ok: false as const,
        intent,
        participantId,
        error: "累計リバイ、未返済、終了時リバイ証を確認してください。",
      };
    }
    const result = await adjustOrganizerRebuyState({
      commandId: readString(formData, "commandId"),
      gameId: params.gameId,
      groupId: authorized.group.id,
      outstandingRebuyCount,
      participantId,
      settlementRebuyCount,
      totalRebuyCount,
    });
    return { ...result, intent, participantId };
  }

  if (intent === "remove") {
    const removed = await removeParticipant(
      authorized.group.id,
      params.gameId,
      participantId,
    );
    return removed
      ? { ok: true as const, intent: "remove" as const, participantId }
      : {
        ok: false as const,
        intent: "remove" as const,
        participantId,
        error: "参加取消に失敗しました。画面を更新してお試しください。",
      };
  }

  throw new Response("Unknown action", { status: 400 });
}

export default function GameAdmin({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const navigation = useNavigation();
  const removalFetcher = useFetcher<typeof action>();
  const rebuyFetcher = useFetcher<OrganizerRebuyActionData>();
  const participantInputFetcher =
    useFetcher<OrganizerParticipantInputActionData>();
  const revalidator = useRevalidator();
  const isSubmitting = navigation.state === "submitting";
  const failedAction =
    actionData?.ok === false && "values" in actionData ? actionData : null;
  const settingsAction =
    failedAction && "errors" in failedAction ? failedAction : null;
  const localRulesError =
    actionData?.ok === false &&
    "intent" in actionData &&
    actionData.intent === "save-local-rules"
      ? actionData.error
      : null;
  const renameAction =
    actionData?.ok === false &&
    "intent" in actionData &&
    actionData.intent === "rename-game" &&
    "title" in actionData
      ? actionData
      : null;
  const deleteAction =
    actionData?.ok === false &&
    "intent" in actionData &&
    actionData.intent === "delete-game"
      ? actionData
      : null;
  const finalizeError =
    actionData?.ok === false &&
    "error" in actionData &&
    !(
      "intent" in actionData &&
      (actionData.intent === "save-local-rules" ||
        actionData.intent === "rename-game" ||
        actionData.intent === "delete-game")
    )
      ? actionData.error
      : null;
  const actionErrors = settingsAction?.errors ?? {};
  const values = failedAction?.values ?? gameToFormValues(loaderData.game);
  const [settlementParticipantCount, setSettlementParticipantCount] = useState(
    values.previewParticipantCount,
  );
  const [optimisticallyRemoved, setOptimisticallyRemoved] = useState<{
    id: string;
    displayName: string;
  } | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<{
    id: string;
    displayName: string;
  } | null>(null);
  const [participantActionMenu, setParticipantActionMenu] = useState<{
    id: string;
    displayName: string;
  } | null>(null);
  const [pendingParticipantInput, setPendingParticipantInput] =
    useState<GameParticipantSummary | null>(null);
  const [pendingRebuyCorrection, setPendingRebuyCorrection] = useState<(
    GameParticipantSummary & { commandId: string }
  ) | null>(null);
  const [toast, setToast] = useState<{
    id: number;
    message: string;
    tone: "success" | "error";
  } | null>(null);
  const participantActionDialogRef = useRef<HTMLDialogElement>(null);
  const participantInputDialogRef = useRef<HTMLDialogElement>(null);
  const removalDialogRef = useRef<HTMLDialogElement>(null);
  const rebuyCorrectionDialogRef = useRef<HTMLDialogElement>(null);
  const participantLinkRef = useRef<HTMLInputElement>(null);
  const rebuySubmissionPendingRef = useRef(false);
  const participantInputSubmissionPendingRef = useRef(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [gameSettingsOpen, setGameSettingsOpen] = useState(
    Boolean(renameAction),
  );
  const [gameDeletionPending, setGameDeletionPending] = useState(
    Boolean(deleteAction),
  );
  const gameSettingsDialogRef = useRef<HTMLDialogElement>(null);
  const gameDeletionDialogRef = useRef<HTMLDialogElement>(null);
  const notice = noticeText(loaderData.notice);
  const visibleParticipants = optimisticallyRemoved
    ? loaderData.participants.filter(
      (participant) => participant.id !== optimisticallyRemoved.id,
    )
    : loaderData.participants;
  const submittedCount = visibleParticipants.filter(
    (participant) =>
      participant.remainingChips !== null &&
      participant.settlementRebuyCount !== null,
  ).length;
  const incompleteCount = visibleParticipants.length - submittedCount;
  const participantStateSummary = summarizeAdminParticipantStates(
    visibleParticipants,
  );
  const totalRebuyCount = visibleParticipants.reduce(
    (total, participant) => total + (participant.totalRebuyCount ?? 0),
    0,
  );
  const totalRepaymentCount = visibleParticipants.reduce(
    (total, participant) =>
      total + Math.max(
        0,
        (participant.totalRebuyCount ?? 0) - participant.outstandingRebuyCount,
      ),
    0,
  );
  const outstandingRebuyCount = visibleParticipants.reduce(
    (total, participant) => total + participant.outstandingRebuyCount,
    0,
  );
  const chipDifference =
    loaderData.finalization.chipValidation?.difference ?? null;



  useEffect(() => {
    if (!notice) return;
    setToast({ id: Date.now(), message: notice, tone: "success" });
    const url = new URL(window.location.href);
    url.searchParams.delete("notice");
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, [notice]);

  useEffect(() => {
    setSettlementParticipantCount(values.previewParticipantCount);
  }, [values.previewParticipantCount]);


  useEffect(() => {
    if (
      removalFetcher.state !== "idle" ||
      removalFetcher.data?.intent !== "remove"
    ) {
      return;
    }
    setOptimisticallyRemoved((removedParticipant) => {
      setToast({
        id: Date.now(),
        message: removalFetcher.data!.ok
          ? `${removedParticipant?.displayName ?? "参加者"}の参加を取り消しました。`
          : removalFetcher.data!.error,
        tone: removalFetcher.data!.ok ? "success" : "error",
      });
      return null;
    });
  }, [removalFetcher.data, removalFetcher.state]);


  useEffect(() => {
    const data = consumeCompletedFetcherSubmission(
      participantInputSubmissionPendingRef,
      participantInputFetcher.state,
      participantInputFetcher.data,
    );
    if (!data) return;
    setToast({
      id: Date.now(),
      message: data.ok ? "終了入力を代理で保存しました。" : data.error,
      tone: data.ok ? "success" : "error",
    });
    if (data.ok) {
      setPendingParticipantInput(null);
      void revalidator.revalidate();
    }
  }, [
    participantInputFetcher.data,
    participantInputFetcher.state,
    revalidator,
  ]);


  useEffect(() => {
    const data = consumeCompletedFetcherSubmission(
      rebuySubmissionPendingRef,
      rebuyFetcher.state,
      rebuyFetcher.data,
    );
    if (!data) return;
    const message = data.ok
      ? data.intent === "record-rebuy"
        ? "リバイを記録しました。"
        : data.intent === "record-repayment"
          ? "100BBの返済を記録しました。"
          : data.intent === "undo-rebuy"
            ? "直前のリバイ操作を元に戻しました。"
            : "リバイ記録を修正しました。"
      : data.error;
    setToast({
      id: Date.now(),
      message,
      tone: data.ok ? "success" : "error",
    });
    if (data.ok) {
      if (data.intent === "adjust-rebuy") setPendingRebuyCorrection(null);
      void revalidator.revalidate();
    }
  }, [rebuyFetcher.data, rebuyFetcher.state, revalidator]);


  useEffect(() => {
    if (!toast) return;
    const timeoutId = window.setTimeout(() => setToast(null), 3_000);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);


  useEffect(() => {
    if (!linkCopied) return;
    const timeoutId = window.setTimeout(() => setLinkCopied(false), 2_000);
    return () => window.clearTimeout(timeoutId);
  }, [linkCopied]);

  useEffect(() => {
    const dialog = gameSettingsDialogRef.current;
    if (!dialog) return;
    if (gameSettingsOpen && !dialog.open) {
      dialog.showModal();
    } else if (!gameSettingsOpen && dialog.open) {
      dialog.close();
    }
  }, [gameSettingsOpen]);

  useEffect(() => {
    const dialog = gameDeletionDialogRef.current;
    if (!dialog) return;
    if (gameDeletionPending && !dialog.open) {
      dialog.showModal();
    } else if (!gameDeletionPending && dialog.open) {
      dialog.close();
    }
  }, [gameDeletionPending]);


  useEffect(() => {
    const dialog = participantActionDialogRef.current;
    if (!dialog) return;
    if (participantActionMenu && !dialog.open) {
      dialog.showModal();
    } else if (!participantActionMenu && dialog.open) {
      dialog.close();
    }
  }, [participantActionMenu]);


  useEffect(() => {
    const dialog = participantInputDialogRef.current;
    if (!dialog) return;
    if (pendingParticipantInput && !dialog.open) {
      dialog.showModal();
    } else if (!pendingParticipantInput && dialog.open) {
      dialog.close();
    }
  }, [pendingParticipantInput]);


  useEffect(() => {
    const dialog = removalDialogRef.current;
    if (!dialog) return;
    if (pendingRemoval && !dialog.open) {
      dialog.showModal();
    } else if (!pendingRemoval && dialog.open) {
      dialog.close();
    }
  }, [pendingRemoval]);


  useEffect(() => {
    const dialog = rebuyCorrectionDialogRef.current;
    if (!dialog) return;
    if (pendingRebuyCorrection && !dialog.open) {
      dialog.showModal();
    } else if (!pendingRebuyCorrection && dialog.open) {
      dialog.close();
    }
  }, [pendingRebuyCorrection]);


  useEffect(() => {
    if (loaderData.game.status === "finalized") return;

    const refresh = () => {
      if (document.visibilityState === "visible" && revalidator.state === "idle") {
        void revalidator.revalidate();
      }
    };
    const intervalId = window.setInterval(refresh, 5_000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refresh);
    };
  }, [loaderData.game.status, revalidator]);

  function submitRebuyAction(
    participantId: string,
    intent: "record-rebuy" | "record-repayment",
  ) {
    if (rebuySubmissionPendingRef.current) return;
    rebuySubmissionPendingRef.current = true;
    void rebuyFetcher.submit(
      { commandId: createCommandId(), intent, participantId },
      { method: "post" },
    );
  }

  function undoRebuy() {
    const data = rebuyFetcher.data;
    if (!data?.ok || !data.eventId) return;
    if (rebuySubmissionPendingRef.current) return;
    rebuySubmissionPendingRef.current = true;
    void rebuyFetcher.submit(
      {
        commandId: createCommandId(),
        eventId: data.eventId,
        intent: "undo-rebuy",
        participantId: data.participantId,
      },
      { method: "post" },
    );
  }

  async function copyParticipantLink() {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(loaderData.participantUrl);
      } else if (!copyInputValue(participantLinkRef.current)) {
        throw new Error("copy command was rejected");
      }
      setLinkCopied(true);
    } catch {
      participantLinkRef.current?.focus();
      participantLinkRef.current?.select();
      setToast({
        id: Date.now(),
        message: "自動コピーできませんでした。リンクを長押ししてコピーしてください。",
        tone: "error",
      });
    }
  }

  return (
    <main className="page-shell form-page admin-page">
      <GroupSiteHeader groupCode={loaderData.group.publicCode} organizer />

      <section className="form-intro setup-intro">
        <p className="eyebrow">ORGANIZER</p>
        <div className="admin-game-title-row">
          <div className="title-with-status">
            <h1>{loaderData.game.title}</h1>
            {loaderData.game.status === "draft" ? (
              <span className={`status status-${loaderData.game.status}`}>
                {statusLabel(loaderData.game.status)}
              </span>
            ) : null}
          </div>
          <button
            aria-label="開催設定を開く"
            className="admin-game-settings-trigger"
            onClick={() => setGameSettingsOpen(true)}
            type="button"
          >
            <IconPencil aria-hidden="true" stroke={1.8} />
            開催設定
          </button>
        </div>
        <p>条件・受付・参加者をまとめて管理できます。</p>
      </section>

      <dialog
        aria-labelledby="game-settings-dialog-title"
        className="app-dialog game-management-dialog"
        onCancel={() => setGameSettingsOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setGameSettingsOpen(false);
        }}
        onClose={() => setGameSettingsOpen(false)}
        ref={gameSettingsDialogRef}
      >
        <div className="dialog-card">
          <div>
            <p className="eyebrow">GAME SETTINGS</p>
            <h2 id="game-settings-dialog-title">開催設定</h2>
            <p>参加者用リンクはそのまま、開催名だけを変更できます。</p>
          </div>
          <Form className="game-title-edit-form" method="post" noValidate>
            <input name="intent" type="hidden" value="rename-game" />
            <label className="field">
              <span className="field-label">開催名</span>
              <input
                aria-invalid={renameAction ? true : undefined}
                autoComplete="off"
                defaultValue={renameAction?.title ?? loaderData.game.title}
                maxLength={GAME_TITLE_MAX_LENGTH}
                name="title"
                required
                type="text"
              />
              {renameAction ? (
                <span className="field-error">{renameAction.error}</span>
              ) : null}
            </label>
            <div className="dialog-actions">
              <button
                className="button button-secondary"
                onClick={() => setGameSettingsOpen(false)}
                type="button"
              >
                キャンセル
              </button>
              <button
                className="button button-primary"
                disabled={
                  navigation.state === "submitting" &&
                  navigation.formData?.get("intent") === "rename-game"
                }
                type="submit"
              >
                {navigation.state === "submitting" &&
                navigation.formData?.get("intent") === "rename-game"
                  ? "保存中…"
                  : "開催名を保存"}
              </button>
            </div>
          </Form>
          <div className="game-danger-zone">
            <div>
              <strong>この開催を削除</strong>
              <p>参加者、チップ入力、リバイ履歴もすべて削除されます。</p>
            </div>
            <button
              className="game-delete-trigger"
              onClick={() => {
                setGameSettingsOpen(false);
                setGameDeletionPending(true);
              }}
              type="button"
            >
              <IconTrash aria-hidden="true" stroke={1.8} />
              削除する
            </button>
          </div>
        </div>
      </dialog>

      <dialog
        aria-labelledby="game-deletion-dialog-title"
        className="app-dialog"
        onCancel={() => setGameDeletionPending(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            setGameDeletionPending(false);
          }
        }}
        onClose={() => setGameDeletionPending(false)}
        ref={gameDeletionDialogRef}
      >
        <div className="dialog-card">
          <span aria-hidden="true" className="dialog-danger-icon">×</span>
          <div>
            <p className="eyebrow">DELETE GAME</p>
            <h2 id="game-deletion-dialog-title">開催を削除しますか？</h2>
            <p>
              <strong>{loaderData.game.title}</strong>
              を削除します。参加者{loaderData.participants.length}人の入力と
              リバイ履歴を含め、元に戻せません。
            </p>
          </div>
          {deleteAction ? (
            <p className="error-notice" role="alert">{deleteAction.error}</p>
          ) : null}
          <Form className="dialog-actions" method="post">
            <input name="intent" type="hidden" value="delete-game" />
            <button
              autoFocus
              className="button button-secondary"
              onClick={() => setGameDeletionPending(false)}
              type="button"
            >
              キャンセル
            </button>
            <button
              className="button button-danger"
              disabled={
                navigation.state === "submitting" &&
                navigation.formData?.get("intent") === "delete-game"
              }
              type="submit"
            >
              {navigation.state === "submitting" &&
              navigation.formData?.get("intent") === "delete-game"
                ? "削除中…"
                : "開催を削除"}
            </button>
          </Form>
        </div>
      </dialog>


      <>
        <section className="admin-share-panel admin-utility-panel">
          <div>
        <section
          aria-labelledby="admin-command-heading"
          className="admin-command-summary"
        >
          <div className="admin-command-heading">
            <div>
              <p className="form-brand-label">LIVE CONTROL</p>
              <h2 id="admin-command-heading">運営状況</h2>
            </div>
            <span className={`status status-${loaderData.game.status}`}>
              {statusLabel(loaderData.game.status)}
            </span>
          </div>
          <div className="admin-command-stats">
            <div className={incompleteCount > 0 ? "is-warning" : "is-clear"}>
              <span>結果入力</span>
              <strong>{submittedCount} / {visibleParticipants.length}人</strong>
              <small>
                {incompleteCount > 0 ? `未入力 ${incompleteCount}人` : "全員入力済み"}
              </small>
            </div>
            <div className={chipDifference === 0 ? "is-clear" : "is-warning"}>
              <span>チップ差分</span>
              <strong>
                {chipDifference === null ? "—" : formatSignedNumber(chipDifference)}
              </strong>
              <small>{chipDifference === 0 ? "一致" : "要確認"}</small>
            </div>
            <div className={outstandingRebuyCount > 0 ? "is-warning" : "is-clear"}>
              <span>未返済リバイ</span>
              <strong>{outstandingRebuyCount}口</strong>
              <small>
                {outstandingRebuyCount > 0 ? "返済状況を確認" : "未返済なし"}
              </small>
            </div>
          </div>
          <nav aria-label="開催管理内の移動" className="admin-command-links">
            <a href="#admin-participants">参加者を見る</a>
            <a href="#admin-settlement">精算・確定へ</a>
          </nav>
        </section>

            <h2>参加者リンク</h2>
            <p>このリンクを参加者に共有してください。</p>
            {loaderData.currentParticipant ? (
              <p>
                この端末は「{loaderData.currentParticipant.displayName}」として参加中です。
              </p>
            ) : null}
          </div>
          <div className="share-link-control">
            <input
              aria-label="参加者用URL"
              onFocus={(event) => event.currentTarget.select()}
              readOnly
              ref={participantLinkRef}
              value={loaderData.participantUrl}
            />
            <button
              aria-label="共有リンクをコピー"
              className="copy-icon-button"
              onClick={copyParticipantLink}
              title={linkCopied ? "コピーしました" : "リンクをコピー"}
              type="button"
            >
              {linkCopied ? (
                <span aria-hidden="true" className="copy-check">
                  ✓
                </span>
              ) : (
                <svg aria-hidden="true" viewBox="0 0 24 24">
                  <rect height="13" rx="2" width="13" x="8" y="8" />
                  <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
                </svg>
              )}
            </button>
          </div>
          <ParticipantLinkQr url={loaderData.participantUrl} />
          <Link
            className="button button-secondary"
            reloadDocument
            to={loaderData.participantUrl}
          >
            {loaderData.currentParticipant
              ? `${loaderData.currentParticipant.displayName} のチップ入力画面を開く`
              : "自分も参加する（参加者画面へ）"}
          </Link>
        </section>

        <section className="admin-participants" id="admin-participants">
          <div className="section-heading">
            <div>
              <p className="form-brand-label">PLAYERS</p>
              <h2>参加者と入力状況</h2>
            </div>
            <span className="count-badge">
              {visibleParticipants.length}人
            </span>
          </div>
          <div
            aria-label="参加者の入力状況内訳"
            className="participant-state-summary"
          >
            <span className="is-complete">
              <small>入力済み</small>
              <strong>{participantStateSummary.complete}人</strong>
            </span>
            <span>
              <small>未入力</small>
              <strong>{participantStateSummary.pending}人</strong>
            </span>
            <span className={participantStateSummary.warning > 0 ? "has-warning" : undefined}>
              <small>要確認</small>
              <strong>{participantStateSummary.warning}人</strong>
            </span>
            <span>
              <small>リバイ累計</small>
              <strong>{totalRebuyCount}回</strong>
            </span>
            <span>
              <small>100BB返済</small>
              <strong>{totalRepaymentCount}回</strong>
            </span>
          </div>
          {visibleParticipants.length === 0 ? (
            <div className="mini-empty">
              <p>まだ参加者はいません。参加者用リンクを共有してください。</p>
            </div>
          ) : (
            <div className="participant-admin-list">
              {visibleParticipants.map((participant) => {
                const inputState = getAdminParticipantInputState(participant);
                const repaymentCount = Math.max(
                  0,
                  (participant.totalRebuyCount ?? 0) -
                    participant.outstandingRebuyCount,
                );
                const isParticipantActionPending =
                  rebuyFetcher.state !== "idle" &&
                  rebuyFetcher.formData?.get("participantId") === participant.id;
                const pendingIntent = isParticipantActionPending
                  ? rebuyFetcher.formData?.get("intent")
                  : null;
                const stateLabel = inputState === "complete"
                  ? "入力済み"
                  : inputState === "warning"
                    ? "要確認"
                    : "未入力";
                const operationsId = "participant-operations-" + participant.id;

                return (
                  <details
                    className={"participant-admin-row is-input-" + inputState}
                    key={participant.id}
                    name="admin-participant"
                    onToggle={(event) => {
                      const currentCard = event.currentTarget;
                      if (!currentCard.open) return;
                      currentCard.parentElement
                        ?.querySelectorAll<HTMLDetailsElement>(
                          "details.participant-admin-row[open]",
                        )
                        .forEach((card) => {
                          if (card !== currentCard) card.removeAttribute("open");
                        });
                    }}
                  >
                    <summary
                      aria-controls={operationsId}
                      className="participant-admin-toggle"
                    >
                      <div className="participant-admin-overview">
                        <div className="participant-admin-primary">
                          <div className="participant-admin-title">
                            <strong>{participant.displayName}</strong>
                            <span className="participant-input-status">
                              {stateLabel}
                            </span>
                          </div>
                          <div className="participant-admin-facts">
                            <span>
                              リバイ {formatTotalRebuyCount(participant.totalRebuyCount)}
                            </span>
                            <span>100BB返済 {repaymentCount}回</span>
                            <span>未返済 {participant.outstandingRebuyCount}口</span>
                          </div>
                        </div>
                        <div className="participant-admin-final">
                          <span>最終入力</span>
                          {participant.remainingChips === null ? (
                            <>
                              <strong>未入力</strong>
                              <small>最終結果の入力待ち</small>
                            </>
                          ) : (
                            <>
                              <strong>
                                最終スタック {participant.remainingChips.toLocaleString("ja-JP")}
                              </strong>
                              <small>
                                リバイ証 {participant.settlementRebuyCount ?? 0}枚
                              </small>
                            </>
                          )}
                          {inputState === "warning" ? (
                            <small className="participant-admin-warning">
                              リバイ記録を確認してください
                            </small>
                          ) : null}
                        </div>
                        <span
                          aria-hidden="true"
                          className="participant-admin-chevron"
                        >
                          ›
                        </span>
                      </div>
                    </summary>

                    <div
                      className="admin-participant-operations"
                      id={operationsId}
                    >
                      <p className="admin-participant-operations-heading">
                        リバイ・返済を代理入力
                      </p>
                      <div className="participant-admin-actions">
                        {participant.status !== "locked" ? (
                          <>
                            <button
                              className="button button-primary button-small"
                              disabled={rebuyFetcher.state !== "idle"}
                              onClick={() =>
                                submitRebuyAction(participant.id, "record-rebuy")
                              }
                              type="button"
                            >
                              {pendingIntent === "record-rebuy"
                                ? "記録中…"
                                : "＋ リバイ"}
                            </button>
                            <button
                              className="button button-secondary button-small"
                              disabled={
                                rebuyFetcher.state !== "idle" ||
                                participant.outstandingRebuyCount === 0
                              }
                              onClick={() =>
                                submitRebuyAction(
                                  participant.id,
                                  "record-repayment",
                                )
                              }
                              type="button"
                            >
                              {pendingIntent === "record-repayment"
                                ? "記録中…"
                                : "100BB返済"}
                            </button>
                          </>
                        ) : null}
                        <button
                          className="button button-secondary button-small"
                          disabled={rebuyFetcher.state !== "idle"}
                          onClick={() =>
                            setPendingRebuyCorrection({
                              ...participant,
                              commandId: createCommandId(),
                            })
                          }
                          type="button"
                        >
                          記録を修正
                        </button>
                        <button
                          aria-label={participant.displayName + "のその他の操作"}
                          className="participant-more-button"
                          onClick={() =>
                            setParticipantActionMenu({
                              id: participant.id,
                              displayName: participant.displayName,
                            })
                          }
                          type="button"
                        >
                          <span aria-hidden="true">…</span>
                        </button>
                      </div>
                      {rebuyFetcher.data?.ok &&
                      rebuyFetcher.data.participantId === participant.id &&
                      (rebuyFetcher.data.intent === "record-rebuy" ||
                        rebuyFetcher.data.intent === "record-repayment") &&
                      rebuyFetcher.data.eventId ? (
                        <button
                          className="text-button participant-admin-undo"
                          disabled={rebuyFetcher.state !== "idle"}
                          onClick={undoRebuy}
                          type="button"
                        >
                          直前の操作を元に戻す
                        </button>
                      ) : null}
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </section>

        <Form className="admin-local-rules" method="post">
          <input name="intent" type="hidden" value="save-local-rules" />
          <div>
            <p className="form-brand-label">LOCAL RULES</p>
            <h2>ローカルルール</h2>
            <p>参加者画面の確認シートへ反映されます。</p>
          </div>
          <label className="local-rule-toggle-card">
            <input
              defaultChecked={loaderData.game.sevenDeuceRuleEnabled}
              name="sevenDeuceRuleEnabled"
              type="checkbox"
              value="yes"
            />
            <span className="local-rule-toggle-copy">
              <strong>72oボーナス</strong>
              <small>
                7と2のオフスートでポットを獲得したら、ほかの参加者全員から2.5BBずつ受け取ります。
              </small>
            </span>
            <span aria-hidden="true" className="local-rule-switch" />
          </label>
          <label className="local-rule-toggle-card">
            <input
              defaultChecked={loaderData.game.bombPotRuleEnabled}
              name="bombPotRuleEnabled"
              type="checkbox"
              value="yes"
            />
            <span className="local-rule-toggle-copy">
              <strong>ボムポット</strong>
              <small>
                決められたタイミングで全員が2.5BBを強制ベットし、プリフロップを飛ばしてフロップからプレイします。
              </small>
            </span>
            <span aria-hidden="true" className="local-rule-switch" />
          </label>
          {localRulesError ? (
            <p className="error-notice" role="alert">{localRulesError}</p>
          ) : null}
          <button
            className="button button-secondary"
            disabled={
              navigation.state === "submitting" &&
              navigation.formData?.get("intent") === "save-local-rules"
            }
            type="submit"
          >
            {navigation.state === "submitting" &&
            navigation.formData?.get("intent") === "save-local-rules"
              ? "保存中…"
              : "ルール設定を保存"}
          </button>
        </Form>

        <Form
          className="game-form admin-finalization-form"
          id="admin-settlement"
          method="post"
          noValidate
        >
          <input name="intent" type="hidden" value="finalize" />
          <GameSettingsFields
            actualParticipantCount={loaderData.participants.length}
            errors={actionErrors}
            onParticipantCountChange={setSettlementParticipantCount}
            showCoreSettings={false}
            values={values}
          />
          <FinalizationPanel
            error={finalizeError}
            finalization={loaderData.finalization}
            isSubmitting={isSubmitting}
            settlementParticipantCount={settlementParticipantCount}
          />
        </Form>
        <dialog
          aria-labelledby="participant-action-title"
          className="participant-action-dialog"
          onCancel={() => setParticipantActionMenu(null)}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setParticipantActionMenu(null);
            }
          }}
          onClose={() => setParticipantActionMenu(null)}
          ref={participantActionDialogRef}
        >
          <div className="participant-action-sheet">
            <div className="participant-action-heading">
              <div>
                <p className="eyebrow">PLAYER ACTIONS</p>
                <h2 id="participant-action-title">
                  {participantActionMenu?.displayName} の操作
                </h2>
              </div>
              <button
                aria-label="操作メニューを閉じる"
                className="participant-action-close"
                onClick={() => setParticipantActionMenu(null)}
                type="button"
              >
                ×
              </button>
            </div>
            <button
              className="participant-action-option"
              onClick={() => {
                const participant = visibleParticipants.find(
                  (item) => item.id === participantActionMenu?.id,
                );
                setParticipantActionMenu(null);
                if (participant) setPendingParticipantInput(participant);
              }}
              type="button"
            >
              <strong>終了入力を代理で入力</strong>
              <small>最終スタックと手元のリバイ証を記録します</small>
            </button>
            <button
              className="participant-action-danger"
              onClick={() => {
                const participant = participantActionMenu;
                setParticipantActionMenu(null);
                if (participant) setPendingRemoval(participant);
              }}
              type="button"
            >
              <strong>この参加者の参加を取り消す</strong>
              <small>チップ入力とリバイ記録も削除されます</small>
            </button>
            <button
              className="button button-secondary participant-action-cancel"
              onClick={() => setParticipantActionMenu(null)}
              type="button"
            >
              キャンセル
            </button>
          </div>
        </dialog>
        <dialog
          aria-labelledby="participant-input-title"
          className="app-dialog participant-input-modal"
          onCancel={() => setPendingParticipantInput(null)}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setPendingParticipantInput(null);
            }
          }}
          onClose={() => setPendingParticipantInput(null)}
          ref={participantInputDialogRef}
        >
          <div className="dialog-card participant-input-dialog">
            <div>
              <p className="eyebrow">RESULT ENTRY</p>
              <h2 id="participant-input-title">終了入力を代理で入力</h2>
              <p>
                <strong>{pendingParticipantInput?.displayName}</strong>
                さんの終了時点の記録を入力します。
              </p>
            </div>
            <participantInputFetcher.Form
              className="participant-input-form"
              key={pendingParticipantInput?.id}
              method="post"
              onSubmit={() => {
                participantInputSubmissionPendingRef.current = true;
              }}
            >
              <input
                name="intent"
                type="hidden"
                value="save-participant-input"
              />
              <input
                name="participantId"
                type="hidden"
                value={pendingParticipantInput?.id ?? ""}
              />
              <input
                name="groupPlayerId"
                type="hidden"
                value={pendingParticipantInput?.groupPlayerId ?? ""}
              />
              <label className="field">
                <span className="field-label">最終スタック</span>
                <input
                  defaultValue={
                    pendingParticipantInput?.remainingChips ??
                    loaderData.game.initialChips
                  }
                  inputMode="numeric"
                  min={0}
                  name="remainingChips"
                  placeholder="0"
                  required
                  type="number"
                />
              </label>
              <label className="field">
                <span className="field-label">手元のリバイ証</span>
                <input
                  defaultValue={
                    pendingParticipantInput?.settlementRebuyCount ??
                    pendingParticipantInput?.outstandingRebuyCount ??
                    0
                  }
                  inputMode="numeric"
                  min={0}
                  name="settlementRebuyCount"
                  placeholder="0"
                  required
                  type="number"
                />
                <span className="field-hint">
                  未入力の場合は現在の未返済口数を初期値にしています。
                </span>
              </label>
              {participantInputFetcher.data?.ok === false &&
              participantInputFetcher.data.participantId ===
                pendingParticipantInput?.id ? (
                <p className="field-error">
                  {participantInputFetcher.data.error}
                </p>
              ) : null}
              <div className="dialog-actions">
                <button
                  className="button button-secondary"
                  onClick={() => setPendingParticipantInput(null)}
                  type="button"
                >
                  キャンセル
                </button>
                <button
                  className="button button-primary"
                  disabled={participantInputFetcher.state !== "idle"}
                  type="submit"
                >
                  {participantInputFetcher.state === "submitting"
                    ? "保存中…"
                    : "代理入力を保存"}
                </button>
              </div>
            </participantInputFetcher.Form>
          </div>
        </dialog>
        <dialog
          aria-labelledby="removal-dialog-title"
          className="app-dialog"
          onCancel={() => setPendingRemoval(null)}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setPendingRemoval(null);
            }
          }}
          onClose={() => setPendingRemoval(null)}
          ref={removalDialogRef}
        >
          <div className="dialog-card">
            <span aria-hidden="true" className="dialog-danger-icon">
              ×
            </span>
            <div>
              <p className="eyebrow">REMOVE PARTICIPANT</p>
              <h2 id="removal-dialog-title">参加を取り消しますか？</h2>
              <p>
                <strong>{pendingRemoval?.displayName}</strong>
                さんをこの会から削除します。入力済みのチップとリバイ記録も削除されます。
              </p>
            </div>
            <removalFetcher.Form
              className="dialog-actions"
              method="post"
              onSubmit={(event) => {
                if (!pendingRemoval) {
                  event.preventDefault();
                  return;
                }
                setOptimisticallyRemoved(pendingRemoval);
                setPendingRemoval(null);
              }}
            >
              <input name="intent" type="hidden" value="remove" />
              <input
                name="participantId"
                type="hidden"
                value={pendingRemoval?.id ?? ""}
              />
              <button
                autoFocus
                className="button button-secondary"
                onClick={() => setPendingRemoval(null)}
                type="button"
              >
                キャンセル
              </button>
              <button className="button button-danger" type="submit">
                参加を取り消す
              </button>
            </removalFetcher.Form>
          </div>
        </dialog>
        <dialog
          aria-labelledby="rebuy-correction-title"
          className="app-dialog"
          onCancel={() => setPendingRebuyCorrection(null)}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setPendingRebuyCorrection(null);
            }
          }}
          onClose={() => setPendingRebuyCorrection(null)}
          ref={rebuyCorrectionDialogRef}
        >
          <div className="dialog-card rebuy-correction-dialog">
            <div>
              <p className="eyebrow">REBUY CORRECTION</p>
              <h2 id="rebuy-correction-title">リバイ記録を修正</h2>
              <p>
                <strong>{pendingRebuyCorrection?.displayName}</strong>
                さんの記録を、実際の運用とリバイ証に合わせます。
              </p>
            </div>
            <rebuyFetcher.Form
              className="rebuy-correction-form"
              key={pendingRebuyCorrection?.id}
              method="post"
              onSubmit={() => {
                rebuySubmissionPendingRef.current = true;
              }}
            >
              <input name="intent" type="hidden" value="adjust-rebuy" />
              <input
                name="participantId"
                type="hidden"
                value={pendingRebuyCorrection?.id ?? ""}
              />
              <input
                name="commandId"
                type="hidden"
                value={pendingRebuyCorrection?.commandId ?? ""}
              />
              <label className="field">
                <span className="field-label">累計リバイ</span>
                <input
                  defaultValue={Math.max(
                    pendingRebuyCorrection?.totalRebuyCount ?? 0,
                    pendingRebuyCorrection?.outstandingRebuyCount ?? 0,
                    pendingRebuyCorrection?.settlementRebuyCount ?? 0,
                  )}
                  inputMode="numeric"
                  min={0}
                  name="totalRebuyCount"
                  required
                  type="number"
                />
              </label>
              <label className="field">
                <span className="field-label">記録上の未返済</span>
                <input
                  defaultValue={
                    pendingRebuyCorrection?.outstandingRebuyCount ?? 0
                  }
                  inputMode="numeric"
                  min={0}
                  name="outstandingRebuyCount"
                  required
                  type="number"
                />
              </label>
              <label className="field">
                <span className="field-label">終了時リバイ証</span>
                <input
                  defaultValue={
                    pendingRebuyCorrection?.settlementRebuyCount ?? ""
                  }
                  inputMode="numeric"
                  min={0}
                  name="settlementRebuyCount"
                  placeholder="結果入力前は空欄"
                  type="number"
                />
              </label>
              <p className="field-hint">
                累計リバイは未返済・終了時リバイ証以上にしてください。
              </p>
              <div className="dialog-actions">
                <button
                  className="button button-secondary"
                  onClick={() => setPendingRebuyCorrection(null)}
                  type="button"
                >
                  キャンセル
                </button>
                <button
                  className="button button-primary"
                  disabled={rebuyFetcher.state !== "idle"}
                  type="submit"
                >
                  {rebuyFetcher.state === "submitting" ? "保存中…" : "修正する"}
                </button>
              </div>
            </rebuyFetcher.Form>
          </div>
        </dialog>
        {toast ? (
          <div
            aria-live="polite"
            className={`app-toast app-toast-${toast.tone}`}
            key={toast.id}
            role={toast.tone === "error" ? "alert" : "status"}
          >
            <span aria-hidden="true">
              {toast.tone === "success" ? "✓" : "!"}
            </span>
            {toast.message}
          </div>
        ) : null}
      </>
    </main>
  );
}

async function requireGame(groupCode: string, gameId: string) {
  const group = await findGroupByPublicCode(groupCode);
  if (!group) throw new Response("Game not found", { status: 404 });
  const game = await findGameForGroup(group.id, gameId);
  if (!game) throw new Response("Game not found", { status: 404 });

  return { group, game };
}

function gameToFormValues(game: Route.ComponentProps["loaderData"]["game"]) {
  const localDate = new Date(
    new Date(game.playedAt).getTime() + 9 * 60 * 60 * 1_000,
  )
    .toISOString()
    .slice(0, 10);
  return {
    title: game.title,
    playedAt: localDate,
    initialChips: String(game.initialChips),
    venueCost: String(game.venueCost),
    firstPlaceCost: String(game.firstPlaceCost),
    secondPlaceCost: String(game.secondPlaceCost),
    thirdPlaceCost: String(game.thirdPlaceCost),
    previewParticipantCount: String(game.previewParticipantCount),
    costShares: (
      game.costShares ??
      calculateCostShares({
        venueCost: game.venueCost,
        participantCount: game.previewParticipantCount,
        firstPlaceCost: game.firstPlaceCost,
        secondPlaceCost: game.secondPlaceCost,
        thirdPlaceCost: game.thirdPlaceCost,
      }).shares
    ).map(String),
    sevenDeuceRuleEnabled: game.sevenDeuceRuleEnabled,
    bombPotRuleEnabled: game.bombPotRuleEnabled,
  };
}

function readAdminCostSettingsForm(
  formData: FormData,
  game: Route.ComponentProps["loaderData"]["game"],
): GameSettingsFormValues {
  return {
    ...gameToFormValues(game),
    venueCost: readString(formData, "venueCost"),
    firstPlaceCost: readString(formData, "firstPlaceCost"),
    secondPlaceCost: readString(formData, "secondPlaceCost"),
    thirdPlaceCost: readString(formData, "thirdPlaceCost"),
    previewParticipantCount: readString(
      formData,
      "previewParticipantCount",
    ),
    costShares: formData
      .getAll("costShare")
      .filter((value): value is string => typeof value === "string"),
  };
}

function parseNonNegativeInteger(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function readString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function statusLabel(status: "draft" | "open" | "finalized") {
  return status === "draft"
    ? "準備中"
    : status === "open"
      ? "受付中"
      : "確定済み";
}

function noticeText(notice: string | null): string | null {
  if (notice === "finalized") return "結果を確定しました。";
  if (notice === "local-rules-saved") return "ローカルルールを保存しました。";
  if (notice === "game-renamed") return "開催名を変更しました。";
  if (notice === "corrected") return "確定結果を訂正しました。";
  return null;
}

function FinalizationPanel({
  error,
  finalization,
  isSubmitting,
  settlementParticipantCount,
}: {
  error: string | null;
  finalization: Route.ComponentProps["loaderData"]["finalization"];
  isSubmitting: boolean;
  settlementParticipantCount: string;
}) {
  const [differenceConfirmed, setDifferenceConfirmed] = useState(false);
  const [rebuyMismatchConfirmed, setRebuyMismatchConfirmed] = useState(false);
  const currentDifference = finalization.chipValidation?.difference ?? null;


  useEffect(() => {
    setDifferenceConfirmed(false);
    setRebuyMismatchConfirmed(false);
  }, [
    currentDifference,
    finalization.isProvisional,
    finalization.rebuyMismatches.length,
  ]);

  const validation = finalization.chipValidation;
  const hasDifference = validation ? !validation.isValid : false;
  const hasRebuyMismatch = finalization.rebuyMismatches.length > 0;
  const participantCountMatches =
    Number(settlementParticipantCount) === finalization.participantCount;
  const settlementParticipantCountLabel = /^\d+$/.test(
    settlementParticipantCount,
  )
    ? `${settlementParticipantCount}人`
    : "未入力";

  return (
    <section className="settlement-panel admin-finalize-panel">
      <div className="section-heading">
        <div>
          <p className="form-brand-label">FINAL CHECK</p>
          <h2 className="finalization-title">
            <span>チップ検算と結果確定</span>
          </h2>
        </div>
      </div>

      {validation ? (
        <div className="chip-summary">
          <div>
            <span>期待総量</span>
            <strong>{formatNumber(validation.expectedTotal)}</strong>
          </div>
          <div>
            <span>報告総量</span>
            <strong>{formatNumber(validation.reportedTotal)}</strong>
          </div>
          <div className={hasDifference ? "has-difference" : "is-matched"}>
            <span>差分</span>
            <strong>{formatSignedNumber(validation.difference)}</strong>
          </div>
        </div>
      ) : null}

      {finalization.participantCount < 4 ? (
        <p className="warning-notice">
          結果確定には4人以上必要です。現在は
          {finalization.participantCount}人です。
        </p>
      ) : null}
      {finalization.isProvisional ? (
        <p className="warning-notice">
          未入力：{finalization.incompleteNames.join("、")}。未入力分は残チップ0・
          リバイ証0枚として暫定計算しています。
        </p>
      ) : null}
      {finalization.invalidRebuyNames.length > 0 ? (
        <p className="error-notice">
          累計リバイより終了時リバイ証が多い参加者：
          {finalization.invalidRebuyNames.join("、")}。参加者一覧から記録を修正してください。
        </p>
      ) : null}
      {hasRebuyMismatch && !finalization.isProvisional ? (
        <div className="rebuy-mismatch-notice">
          <strong>リバイ記録と終了時リバイ証に差があります。</strong>
          {finalization.rebuyMismatches.map((mismatch) => (
            <span key={mismatch.displayName}>
              {mismatch.displayName}：記録 {mismatch.outstandingRebuyCount}口 /
              リバイ証 {mismatch.settlementRebuyCount}枚
            </span>
          ))}
        </div>
      ) : null}
      {validation?.isValid && !finalization.isProvisional ? (
        <p className="match-notice">チップ総量は一致しています。</p>
      ) : null}
      {hasDifference && !finalization.isProvisional ? (
        <p className="warning-notice difference-warning">
          {validation!.difference > 0
            ? `${formatNumber(validation!.difference)}チップ不足しています。`
            : `${formatNumber(Math.abs(validation!.difference))}チップ多く報告されています。`}
          入力を見直すか、差分を確認して確定してください。
        </p>
      ) : null}

      <div className="finalize-form">
        {hasDifference && !finalization.isProvisional ? (
          <label className="confirmation-check">
            <input
              checked={differenceConfirmed}
              name="confirmDifference"
              onChange={(event) =>
                setDifferenceConfirmed(event.target.checked)
              }
              required
              type="checkbox"
              value="yes"
            />
            <span className="confirmation-copy">
              <strong>差分を確認しました</strong>
              <small>この差分を含む結果で確定します。</small>
            </span>
          </label>
        ) : null}
        {hasRebuyMismatch && !finalization.isProvisional ? (
          <label className="confirmation-check">
            <input
              checked={rebuyMismatchConfirmed}
              name="confirmRebuyMismatch"
              onChange={(event) =>
                setRebuyMismatchConfirmed(event.target.checked)
              }
              required
              type="checkbox"
              value="yes"
            />
            <span className="confirmation-copy">
              <strong>リバイ記録との差を確認しました</strong>
              <small>終了時リバイ証を精算値として結果を確定します。</small>
            </span>
          </label>
        ) : null}
        {!participantCountMatches ? (
          <p className="warning-notice">
            会費精算の人数（{settlementParticipantCountLabel}）と参加者（
            {finalization.participantCount}人）を一致させてください。
          </p>
        ) : null}
        {error ? (
          <p className="error-notice finalize-error" role="alert">
            <span aria-hidden="true" className="finalize-error-icon">
              !
            </span>
            <span>{error}</span>
          </p>
        ) : null}
        <button
          className="button button-primary"
          disabled={
            !finalization.canFinalize ||
            !participantCountMatches ||
            isSubmitting ||
            (hasDifference && !differenceConfirmed) ||
            (hasRebuyMismatch && !rebuyMismatchConfirmed)
          }
          type="submit"
        >
          {isSubmitting ? "処理中…" : "この精算設定で結果を確定"}
        </button>
        <p className="finalize-hint">
          確定時に上の精算設定も保存します。確定後は変更できません。
        </p>
      </div>
    </section>
  );
}

function formatTotalRebuyCount(value: number | null): string {
  return value === null ? "記録なし" : String(value) + "回";
}

function formatNumber(value: number): string {
  return value.toLocaleString("ja-JP");
}

function formatSignedNumber(value: number): string {
  if (value === 0) return "0";
  return `${value > 0 ? "+" : "−"}${formatNumber(Math.abs(value))}`;
}

function copyInputValue(input: HTMLInputElement | null): boolean {
  if (!input) return false;
  input.focus();
  input.select();
  input.setSelectionRange(0, input.value.length);
  return document.execCommand("copy");
}
