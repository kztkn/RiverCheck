import { GroupSiteHeader } from "~/components/site-menu";
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
} from "@server/repositories/game-repository.server";
import { findGroupByPublicCode } from "@server/repositories/group-repository.server";
import {
  findParticipantByTokenHash,
  listGameParticipants,
  removeParticipant,
} from "@server/repositories/participant-repository.server";
import { readParticipantToken } from "@server/services/participant-session.server";
import { hashToken } from "@server/services/token.server";
import { requireOrganizer } from "@server/services/organizer-auth.server";
import {
  type GameSettingsFormValues,
  validateGameSettingsForm,
} from "@server/services/game-service.server";
import {
  buildFinalizationState,
  finalizeGame,
} from "@server/services/finalization-service.server";
import { GameSettingsFields } from "../components/game-settings-fields";
import { ParticipantLinkQr } from "../components/participant-link-qr";
import type { Route } from "./+types/game-admin";

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
      authorized.group.id,
      params.gameId,
      validation.input,
      readString(formData, "confirmDifference") === "yes",
    );
    if (!result.ok) return { ...result, values };
    return redirect(
      "/g/" + params.groupCode + "/games/" + params.gameId + "?notice=finalized",
    );
  }

  const participantId = readString(formData, "participantId");
  if (!isUuid(participantId)) {
    throw new Response("Invalid participant", { status: 400 });
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
  const revalidator = useRevalidator();
  const isSubmitting = navigation.state === "submitting";
  const failedAction =
    actionData?.ok === false && "values" in actionData ? actionData : null;
  const settingsAction =
    failedAction && "errors" in failedAction ? failedAction : null;
  const finalizeError =
    actionData?.ok === false && "error" in actionData ? actionData.error : null;
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
  const [toast, setToast] = useState<{
    id: number;
    message: string;
    tone: "success" | "error";
  } | null>(null);
  const removalDialogRef = useRef<HTMLDialogElement>(null);
  const participantLinkRef = useRef<HTMLInputElement>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const notice = noticeText(loaderData.notice);
  const visibleParticipants = optimisticallyRemoved
    ? loaderData.participants.filter(
      (participant) => participant.id !== optimisticallyRemoved.id,
    )
    : loaderData.participants;

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
    const dialog = removalDialogRef.current;
    if (!dialog) return;
    if (pendingRemoval && !dialog.open) {
      dialog.showModal();
    } else if (!pendingRemoval && dialog.open) {
      dialog.close();
    }
  }, [pendingRemoval]);

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
        <div className="title-with-status">
          <h1>{loaderData.game.title}</h1>
          {loaderData.game.status !== "finalized" ? (
            <span className={`status status-${loaderData.game.status}`}>
              {statusLabel(loaderData.game.status)}
            </span>
          ) : null}
        </div>
        <p>この専用URLから、条件・受付・参加者をまとめて管理できます。</p>
      </section>

      {notice ? <p className="success-notice">{notice}</p> : null}

      <>
          <section className="admin-share-panel">
            <div>
              <h2>PARTICIPANT LINK</h2>
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

          <section className="admin-participants">
            <div className="section-heading">
              <div>
                <h2>PARTICIPANTS</h2>
              </div>
              <span className="count-badge">
                {visibleParticipants.length}人
              </span>
            </div>
            {visibleParticipants.length === 0 ? (
              <div className="mini-empty">
                <p>まだ参加者はいません。参加者用リンクを共有してください。</p>
              </div>
            ) : (
              <div className="participant-admin-list">
                {visibleParticipants.map((participant) => (
                  <article className="participant-admin-row" key={participant.id}>
                    <div>
                      <strong>{participant.displayName}</strong>
                      <span>
                        {participant.remainingChips === null
                          ? "未入力"
                          : `残り ${participant.remainingChips.toLocaleString("ja-JP")} / リバイ ${participant.rebuyCount}回`}
                      </span>
                    </div>
                    {loaderData.game.status !== "finalized" ? (
                      <button
                        aria-label={`${participant.displayName}の参加を取り消す`}
                        className="participant-remove-button"
                        disabled={removalFetcher.state !== "idle"}
                        onClick={() =>
                          setPendingRemoval({
                            id: participant.id,
                            displayName: participant.displayName,
                          })
                        }
                        title="参加を取り消す"
                        type="button"
                      >
                        <span aria-hidden="true">×</span>
                      </button>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </section>

          <Form className="game-form" method="post" noValidate>
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
                  さんをこの会から削除します。入力済みのチップとリバイ回数も削除されます。
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
  };
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
  if (notice === "corrected") return "確定結果を訂正しました。";
  if (notice === "highlight-saved") return "ハイライトを保存しました。";
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
  const currentDifference = finalization.chipValidation?.difference ?? null;

  useEffect(() => {
    setDifferenceConfirmed(false);
  }, [currentDifference, finalization.isProvisional]);

  const validation = finalization.chipValidation;
  const hasDifference = validation ? !validation.isValid : false;
  const participantCountMatches =
    Number(settlementParticipantCount) === finalization.participantCount;
  const settlementParticipantCountLabel = /^\d+$/.test(
    settlementParticipantCount,
  )
    ? `${settlementParticipantCount}人`
    : "未入力";

  return (
    <section className="settlement-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">CHIP CHECK</p>
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
          リバイ0回として暫定計算しています。
        </p>
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
            (hasDifference && !differenceConfirmed)
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
