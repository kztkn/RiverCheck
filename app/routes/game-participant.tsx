import { Form, Link, redirect, useNavigation } from "react-router";
import { useState } from "react";
import { findGameForGroup } from "@server/repositories/game-repository.server";
import { findGroupByPublicCode } from "@server/repositories/group-repository.server";
import {
  listFinalResults,
  listResultRevisions,
} from "@server/repositories/finalization-repository.server";
import {
  claimRegisteredParticipant,
  findParticipantByTokenHash,
  joinNewParticipant,
  leaveGame,
  listRegisteredPlayersForGame,
  updateParticipantInput,
} from "@server/repositories/participant-repository.server";
import {
  clearParticipantCookie,
  createParticipantCookie,
  readParticipantToken,
} from "@server/services/participant-session.server";
import { generateOpaqueToken, hashToken } from "@server/services/token.server";
import { formatLineResult } from "@domain/result-sharing/format-line-result";
import {
  buildGamePhotoUrl,
  getGameHighlight,
} from "@server/services/game-highlight-service.server";
import { FinalResults } from "../components/final-results";
import { GameHighlight } from "../components/game-highlight";
import type { Route } from "./+types/game-participant";

export async function loader({ request, params }: Route.LoaderArgs) {
  const context = await requireGame(params.groupCode, params.gameId);
  const url = new URL(request.url);
  const token = readParticipantToken(request, params.gameId);
  const participant = token
    ? await findParticipantByTokenHash(
      context.group.id,
      params.gameId,
      await hashToken(token),
    )
    : null;
  const players =
    context.game.status === "open" && !participant
      ? await listRegisteredPlayersForGame(context.group.id, params.gameId)
      : [];
  const results =
    context.game.status === "finalized"
      ? await listFinalResults(context.group.id, params.gameId)
      : [];
  const revisions =
    context.game.status === "finalized"
      ? await listResultRevisions(context.group.id, params.gameId)
      : [];
  const highlight =
    context.game.status === "finalized"
      ? await getGameHighlight(context.group.id, params.gameId)
      : null;
  return {
    group: { name: context.group.name, publicCode: context.group.publicCode },
    game: context.game,
    participant,
    players,
    results,
    revisions,
    highlight,
    highlightPhotoUrl: buildGamePhotoUrl({
      gameId: params.gameId,
      groupCode: params.groupCode,
      highlight,
    }),
    lineText:
      results.length > 0
        ? formatLineResult(
          context.game.title,
          results,
          context.game.initialChips,
        )
        : "",
    shareUrl: `${url.origin}${url.pathname}`,
    notice: url.searchParams.get("notice"),
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const context = await requireGame(params.groupCode, params.gameId);
  const formData = await request.formData();
  const intent = readString(formData, "intent");
  const participantUrl = `/g/${params.groupCode}/games/${params.gameId}`;

  if (intent === "join-existing" || intent === "join-new") {
    if (context.game.status !== "open") {
      return { error: "現在は参加を受け付けていません。" };
    }

    const token = generateOpaqueToken();
    const tokenHash = await hashToken(token);
    let joined = false;

    if (intent === "join-existing") {
      const groupPlayerId = readString(formData, "groupPlayerId");
      if (!isUuid(groupPlayerId)) return { error: "名前を選んでください。" };
      joined = await claimRegisteredParticipant(
        context.group.id,
        params.gameId,
        groupPlayerId,
        tokenHash,
      );
      if (!joined) {
        return {
          error:
            "この参加者はすでに使用中です。本人が利用できない場合は、主催者に参加取消を頼んでから参加し直してください。",
        };
      }
    } else {
      const displayName = readString(formData, "displayName").trim();
      if (!displayName || displayName.length > 60) {
        return { error: "名前を1〜60文字で入力してください。" };
      }
      joined = await joinNewParticipant(
        context.group.id,
        params.gameId,
        displayName,
        tokenHash,
      );
      if (!joined)
        return { error: "参加できませんでした。画面を更新してください。" };
    }

    return redirect(`${participantUrl}?notice=joined`, {
      status: 303,
      headers: {
        "Set-Cookie": createParticipantCookie(
          request,
          params.groupCode,
          params.gameId,
          token,
        ),
      },
    });
  }

  const token = readParticipantToken(request, params.gameId);
  if (!token)
    return { error: "参加情報を確認できません。もう一度参加してください。" };
  const tokenHash = await hashToken(token);

  if (intent === "save-input") {
    const remainingChips = parseNonNegativeInteger(
      readString(formData, "remainingChips"),
    );
    const rebuyCount = parseNonNegativeInteger(
      readString(formData, "rebuyCount"),
    );
    if (remainingChips === null || rebuyCount === null) {
      return {
        error: "残りチップとリバイ回数は0以上の整数で入力してください。",
      };
    }
    const updated = await updateParticipantInput(
      context.group.id,
      params.gameId,
      tokenHash,
      remainingChips,
      rebuyCount,
    );
    if (!updated)
      return {
        error: "入力を保存できませんでした。受付状況を確認してください。",
      };
    return redirect(`${participantUrl}?notice=saved`, { status: 303 });
  }

  if (intent === "leave") {
    await leaveGame(context.group.id, params.gameId, tokenHash);
    return redirect(`${participantUrl}?notice=left`, {
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

  throw new Response("Unknown action", { status: 400 });
}

export default function GameParticipant({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [isEditing, setIsEditing] = useState(false);

  return (
    <main className="page-shell participant-page">
      <header className="site-header">
        <Link className="brand" to={`/g/${loaderData.group.publicCode}`}>
          <span className="brand-mark">RC</span>
          <span>RiverCheck</span>
        </Link>
        <div className="header-actions">
          <Link className="text-link" reloadDocument to="admin">
            主催者画面へ
          </Link>
          <span className={`status status-${loaderData.game.status}`}>
            {loaderData.game.status === "open"
              ? "受付中"
              : loaderData.game.status === "draft"
                ? "準備中"
                : "確定済み"}
          </span>
        </div>
      </header>

      <section className="participant-hero">
        <p className="eyebrow">JOIN THE TABLE</p>
        <h1>{loaderData.game.title}</h1>
        {loaderData.game.status !== "finalized" ? (
          <p>
            {new Intl.DateTimeFormat("ja-JP", {
              dateStyle: "long",
              timeZone: "Asia/Tokyo",
            }).format(new Date(loaderData.game.playedAt))}
          </p>
        ) : null}
      </section>

      {loaderData.notice === "joined" ? (
        <p className="success-notice">
          参加しました。終了時に結果を入力してください。
        </p>
      ) : null}
      {loaderData.notice === "saved" ? (
        <p className="success-notice">
          結果を保存しました。確定までは何度でも変更できます。
        </p>
      ) : null}
      {loaderData.notice === "left" ? (
        <p className="success-notice">参加を取り消しました。</p>
      ) : null}
      {actionData?.error ? (
        <p className="error-notice">{actionData.error}</p>
      ) : null}

      {loaderData.game.status === "finalized" ? (
        <>
        <FinalResults
          lineText={loaderData.lineText}
          initialChips={loaderData.game.initialChips}
          playedAt={loaderData.game.playedAt}
          results={loaderData.results}
          revisions={loaderData.revisions}
          shareUrl={loaderData.shareUrl}
          showSharePanel={false}
        />
        <GameHighlight
          gameTitle={loaderData.game.title}
          highlight={loaderData.highlight}
          photoUrl={loaderData.highlightPhotoUrl}
        />
        </>
      ) : loaderData.game.status === "draft" ? (
        <section className="participant-panel waiting-panel">
          <span className="empty-icon" aria-hidden="true">
            ♠
          </span>
          <h2>受付開始をお待ちください</h2>
          <p>主催者が受付を開始すると、このページから参加できます。</p>
        </section>
      ) : loaderData.participant ? (
        <section className="participant-panel">
          <div className="participant-identity">
            <span className="member-avatar">YOU</span>
            <div>
              <p>参加中</p>
              <h2>{loaderData.participant.displayName}</h2>
            </div>
          </div>

          {loaderData.participant.status === "submitted" && !isEditing ? (
            <section className="submitted-input" aria-label="保存済みの結果">
              <div>
                <p className="eyebrow">SUBMITTED</p>
                <h3>入力済みです</h3>
                <p>主催者が結果を確定するまでは修正できます。</p>
              </div>
              <div className="submitted-input-values">
                <div>
                  <span>残りチップ</span>
                  <strong>
                    {loaderData.participant.remainingChips?.toLocaleString(
                      "ja-JP",
                    ) ?? 0}
                  </strong>
                </div>
                <div>
                  <span>リバイ回数</span>
                  <strong>{loaderData.participant.rebuyCount}回</strong>
                </div>
              </div>
              <button
                className="button button-secondary"
                onClick={() => setIsEditing(true)}
                type="button"
              >
                入力を修正する
              </button>
            </section>
          ) : (
            <Form
              className="result-entry-form"
              method="post"
              noValidate
              reloadDocument
            >
              <input name="intent" type="hidden" value="save-input" />
              <label className="field">
                <span className="field-label">残りチップ</span>
                <input
                  defaultValue={loaderData.participant.remainingChips ?? ""}
                  inputMode="numeric"
                  min={0}
                  name="remainingChips"
                  placeholder="0"
                  required
                  type="number"
                />
              </label>
              <label className="field">
                <span className="field-label">リバイ回数</span>
                <input
                  defaultValue={loaderData.participant.rebuyCount}
                  inputMode="numeric"
                  min={0}
                  name="rebuyCount"
                  required
                  type="number"
                />
              </label>
              <button
                className="button button-primary"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? "保存中…" : "結果を保存"}
              </button>
            </Form>
          )}

          <Form method="post" reloadDocument>
            <input name="intent" type="hidden" value="leave" />
            <button className="text-button danger-text" type="submit">
              参加を取り消す
            </button>
          </Form>
        </section>
      ) : (
        <div className="join-grid">
          <section className="participant-panel">
            <p className="eyebrow">REGISTERED</p>
            <h2>登録済みの名前から参加</h2>
            <p className="muted-copy">
              過去の確定済み開催によく参加している人から表示しています。
            </p>
            {loaderData.players.length === 0 ? (
              <p className="muted-copy">登録済みメンバーはまだいません。</p>
            ) : (
              <div className="player-join-list">
                {loaderData.players.map((player) => (
                  <Form
                    className="player-join-form"
                    key={player.id}
                    method="post"
                    reloadDocument
                  >
                    <input name="intent" type="hidden" value="join-existing" />
                    <input
                      name="groupPlayerId"
                      type="hidden"
                      value={player.id}
                    />
                    <button
                      aria-label={`${player.displayName}として参加`}
                      className="player-join-button"
                      disabled={player.deviceLocked || isSubmitting}
                      type="submit"
                    >
                      <span>{player.displayName}</span>
                      <small>{player.deviceLocked ? "使用中" : "参加"}</small>
                    </button>
                  </Form>
                ))}
              </div>
            )}
          </section>

          <section className="participant-panel new-player-panel">
            <div>
              <h2>一覧に名前がない方</h2>
              <p className="muted-copy">
                名前を追加して参加できます。次回から一覧に表示されます。
              </p>
            </div>
            <Form className="new-player-form" method="post" reloadDocument>
              <input name="intent" type="hidden" value="join-new" />
              <label className="field">
                <span className="field-label">表示名</span>
                <input
                  maxLength={60}
                  name="displayName"
                  placeholder="例：PKサンダー"
                  required
                />
              </label>
              <button
                className="button button-secondary"
                disabled={isSubmitting}
                type="submit"
              >
                この名前で参加
              </button>
            </Form>
          </section>
        </div>
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

function readString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function parseNonNegativeInteger(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
