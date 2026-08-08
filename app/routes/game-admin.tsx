import { useEffect, useState } from "react";
import {
  Form,
  Link,
  redirect,
  useNavigation,
  useRevalidator,
} from "react-router";
import {
  findGameForGroup,
} from "@server/repositories/game-repository.server";
import { findGroupByPublicCode } from "@server/repositories/group-repository.server";
import { listFinalResults } from "@server/repositories/finalization-repository.server";
import {
  findParticipantByTokenHash,
  listGameParticipants,
  removeParticipant,
} from "@server/repositories/participant-repository.server";
import { readParticipantToken } from "@server/services/participant-session.server";
import { hashToken } from "@server/services/token.server";
import {
  type GameSettingsFormValues,
  validateGameSettingsForm,
} from "@server/services/game-service.server";
import {
  buildFinalizationState,
  finalizeGame,
} from "@server/services/finalization-service.server";
import { formatLineResult } from "@domain/result-sharing/format-line-result";
import { GameSettingsFields } from "../components/game-settings-fields";
import { FinalResults } from "../components/final-results";
import type { Route } from "./+types/game-admin";

export async function loader({ request, params }: Route.LoaderArgs) {
  const authorized = await requireGame(params.groupCode, params.gameId);
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
  const results =
    authorized.game.status === "finalized"
      ? await listFinalResults(authorized.group.id, params.gameId)
      : [];

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
    results,
    lineText:
      results.length > 0
        ? formatLineResult(authorized.game.title, results)
        : "",
    participantUrl: `${url.origin}/g/${params.groupCode}/games/${params.gameId}`,
    notice: url.searchParams.get("notice"),
  };

  return payload;
}

export async function action({ request, params }: Route.ActionArgs) {
  const authorized = await requireGame(params.groupCode, params.gameId);
  const formData = await request.formData();
  const intent = readString(formData, "intent");
  const returnUrl = `/g/${params.groupCode}/games/${params.gameId}/admin`;
  const noticeUrl = (notice: string) => `${returnUrl}?notice=${notice}`;

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
    return redirect(noticeUrl("finalized"));
  }

  const participantId = readString(formData, "participantId");
  if (!isUuid(participantId)) {
    throw new Response("Invalid participant", { status: 400 });
  }

  if (intent === "remove") {
    await removeParticipant(authorized.group.id, params.gameId, participantId);
    return redirect(noticeUrl("removed"));
  }

  throw new Response("Unknown action", { status: 400 });
}

export default function GameAdmin({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const navigation = useNavigation();
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
  const notice = noticeText(loaderData.notice);

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

  return (
    <main className="page-shell form-page admin-page">
      <header className="site-header">
        <Link className="brand" to={`/g/${loaderData.group.publicCode}/manage`}>
          <span className="brand-mark">RC</span>
          <span>RiverCheck</span>
        </Link>
        <Link
          className="text-link"
          to={`/g/${loaderData.group.publicCode}/manage`}
        >
          ← 主催者画面
        </Link>
      </header>

      <section className="form-intro setup-intro">
        <p className="eyebrow">ORGANIZER</p>
        <div className="title-with-status">
          <h1>{loaderData.game.title}</h1>
          <span className={`status status-${loaderData.game.status}`}>
            {statusLabel(loaderData.game.status)}
          </span>
        </div>
        <p>この専用URLから、条件・受付・参加者をまとめて管理できます。</p>
      </section>

      {notice ? <p className="success-notice">{notice}</p> : null}

      {loaderData.game.status === "finalized" ? (
        <FinalResults
          lineText={loaderData.lineText}
          results={loaderData.results}
          shareUrl={loaderData.participantUrl}
        />
      ) : (
        <>
          <section className="admin-share-panel">
        <div>
          <p className="eyebrow">PARTICIPANT LINK</p>
          <h2>みんなに送るリンク</h2>
          <p>
            {loaderData.currentParticipant
              ? `この端末は「${loaderData.currentParticipant.displayName}」として参加中です。`
              : "参加者はこのリンクを開き、自分の名前を選ぶか新しく入力します。"}
          </p>
        </div>
        <input
          aria-label="参加者用URL"
          readOnly
          value={loaderData.participantUrl}
        />
        <Link
          className="button button-secondary"
          reloadDocument
          to={loaderData.participantUrl}
        >
          {loaderData.currentParticipant
            ? `${loaderData.currentParticipant.displayName}の入力画面を開く`
            : "自分も参加する（参加者画面へ）"}
        </Link>
          </section>

          <section className="admin-participants">
        <div className="section-heading">
          <div>
            <p className="eyebrow">PARTICIPANTS</p>
            <h2>参加状況</h2>
          </div>
          <span className="count-badge">
            {loaderData.participants.length}人
          </span>
        </div>
        {loaderData.participants.length === 0 ? (
          <div className="mini-empty">
            <p>まだ参加者はいません。参加者用リンクを共有してください。</p>
          </div>
        ) : (
          <div className="participant-admin-list">
            {loaderData.participants.map((participant) => (
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
                  <Form className="participant-remove-form" method="post">
                    <input name="intent" type="hidden" value="remove" />
                    <input
                      name="participantId"
                      type="hidden"
                      value={participant.id}
                    />
                    <button
                      aria-label={`${participant.displayName}の参加を取り消す`}
                      className="participant-remove-button"
                      onClick={(event) => {
                        if (
                          !window.confirm(
                            `${participant.displayName}の参加を取り消しますか？\n入力済みのチップとリバイ回数も削除されます。`,
                          )
                        ) {
                          event.preventDefault();
                        }
                      }}
                      title="参加を取り消す"
                      type="submit"
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                  </Form>
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
              showCoreSettings={false}
              values={values}
            />
            <FinalizationPanel
              error={finalizeError}
              finalization={loaderData.finalization}
              isSubmitting={isSubmitting}
            />
          </Form>
        </>
      )}
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
  if (notice === "removed") return "参加を取り消しました。";
  return null;
}

function FinalizationPanel({
  error,
  finalization,
  isSubmitting,
}: {
  error: string | null;
  finalization: Route.ComponentProps["loaderData"]["finalization"];
  isSubmitting: boolean;
}) {
  const [differenceConfirmed, setDifferenceConfirmed] = useState(false);
  const currentDifference = finalization.chipValidation?.difference ?? null;

  useEffect(() => {
    setDifferenceConfirmed(false);
  }, [currentDifference]);

  const validation = finalization.chipValidation;
  const hasDifference = validation ? !validation.isValid : false;

  return (
    <section className="settlement-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">CHIP CHECK</p>
          <h2>チップ総量と結果確定</h2>
        </div>
        <span className="count-badge">
          {finalization.submittedCount}/{finalization.participantCount}人入力
        </span>
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
      {finalization.incompleteNames.length > 0 ? (
        <p className="warning-notice">
          未入力：{finalization.incompleteNames.join("、")}
        </p>
      ) : null}
      {validation?.isValid ? (
        <p className="match-notice">チップ総量は一致しています。</p>
      ) : null}
      {hasDifference ? (
        <p className="warning-notice difference-warning">
          {validation!.difference > 0
            ? `${formatNumber(validation!.difference)}チップ不足しています。`
            : `${formatNumber(Math.abs(validation!.difference))}チップ多く報告されています。`}
          入力を見直すか、差分を確認して確定してください。
        </p>
      ) : null}

      <div className="finalize-form">
        {hasDifference ? (
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
