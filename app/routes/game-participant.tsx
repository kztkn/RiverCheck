import {
  Form,
  Link,
  redirect,
  useNavigation,
  useRevalidator,
} from "react-router";
import { useEffect, useState } from "react";
import {
  findGameForGroup,
  listGamesForGroup,
} from "@server/repositories/game-repository.server";
import { findGroupByPublicCode } from "@server/repositories/group-repository.server";
import {
  listFinalResults,
  listResultRevisions,
} from "@server/repositories/finalization-repository.server";
import {
  findParticipantByGroupPlayerId,
  joinAuthenticatedParticipant,
  joinNewParticipant,
  leaveGame,
  leaveGameByGroupPlayerId,
  listRegisteredPlayersForGame,
  updateParticipantInput,
  updateParticipantInputByGroupPlayerId,
} from "@server/repositories/participant-repository.server";
import {
  clearParticipantCookie,
  createParticipantCookie,
  readParticipantToken,
} from "@server/services/participant-session.server";
import { generateOpaqueToken, hashToken } from "@server/services/token.server";
import { formatLineResult } from "@domain/result-sharing/format-line-result";
import { PLAYER_DISPLAY_NAME_MAX_LENGTH } from "@domain/player-profile/validate-player-profile";
import {
  buildGamePhotoUrl,
  getGameHighlight,
} from "@server/services/game-highlight-service.server";
import { FinalResults } from "../components/final-results";
import { PlayerAvatar } from "../components/player-avatar";
import {
  createNewPlayerProfileSessionCredentials,
  getAuthenticatedPlayerProfile,
  selectPlayerProfile,
} from "@server/services/player-profile-service.server";
import { buildPlayerAvatarUrl } from "@domain/player-profile/build-player-avatar-url";
import { createPlayerProfileCookie } from "@server/services/player-profile-session.server";
import { GameHighlight } from "../components/game-highlight";
import { GroupSiteHeader } from "~/components/site-menu";
import { isOrganizerAuthenticated } from "@server/services/organizer-auth.server";
import { isPayPayLinkActive } from "@domain/payment/paypay-link";
import { findGamePaymentAmountForPlayer } from "@server/repositories/group-paypay-repository.server";
import type { GameListItem } from "@shared-types/game";
import type { Route } from "./+types/game-participant";
import { formatTokyoDateNumeric } from "@domain/date/format-tokyo-date";

export async function loader({ request, params }: Route.LoaderArgs) {
  const context = await requireGame(params.groupCode, params.gameId);
  const [isOrganizer, profileOverview] = await Promise.all([
    isOrganizerAuthenticated(request),
    getAuthenticatedPlayerProfile(request, params.groupCode),
  ]);
  const url = new URL(request.url);
  let participant = profileOverview?.profile
    ? await findParticipantByGroupPlayerId(
      context.group.id,
      params.gameId,
      profileOverview.profile.groupPlayerId,
    )
    : null;
  if (
    !participant &&
    context.game.status === "open" &&
    profileOverview?.profile
  ) {
    await joinAuthenticatedParticipant(
      context.group.id,
      params.gameId,
      profileOverview.profile.groupPlayerId,
      await hashToken(generateOpaqueToken()),
    );
    participant = await findParticipantByGroupPlayerId(
      context.group.id,
      params.gameId,
      profileOverview.profile.groupPlayerId,
    );
  }
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
  const finalizedGames =
    context.game.status === "finalized"
      ? (await listGamesForGroup(context.group.id)).filter(
        (game) => game.status === "finalized",
      )
      : [];
  const payPayRecipientLink = isPayPayLinkActive({
    link: context.group.payPayRecipientLink,
    registeredAt: context.group.payPayLinkRegisteredAt,
  })
    ? context.group.payPayRecipientLink
    : null;
  const payPayPaymentAmount =
    context.game.status === "finalized" &&
    payPayRecipientLink &&
    profileOverview?.profile
      ? await findGamePaymentAmountForPlayer(
        context.group.id,
        params.gameId,
        profileOverview.profile.playerId,
      )
      : null;
  return {
    group: { name: context.group.name, publicCode: context.group.publicCode },
    game: context.game,
    isOrganizer,
    participant: participant
      ? {
        ...participant,
        avatarUrl: buildPlayerAvatarUrl({
          avatarUpdatedAt: participant.avatarUpdatedAt,
          groupCode: params.groupCode,
          groupPlayerId: participant.groupPlayerId,
        }),
      }
      : null,
    players: players.map((player) => ({
      ...player,
      avatarUrl: buildPlayerAvatarUrl({
        avatarUpdatedAt: player.avatarUpdatedAt,
        groupCode: params.groupCode,
        groupPlayerId: player.id,
      }),
    })),
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
    pastGameNavigation: buildPastGameNavigation(finalizedGames, params.gameId),
    payPay: payPayRecipientLink
      ? { link: payPayRecipientLink, paymentAmount: payPayPaymentAmount }
      : null,
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
    let profileSessionToken: string | null = null;

    if (intent === "join-existing") {
      const groupPlayerId = readString(formData, "groupPlayerId");
      if (!isUuid(groupPlayerId)) return { error: "名前を選んでください。" };
      const selected = await selectPlayerProfile(
        params.groupCode,
        groupPlayerId,
      );
      if (!selected.ok) return { error: selected.error };
      await joinAuthenticatedParticipant(
        context.group.id,
        params.gameId,
        groupPlayerId,
        tokenHash,
      );
      joined = true;
      profileSessionToken = selected.sessionToken;
    } else {
      const displayName = readString(formData, "displayName").trim();
      if (
        !displayName ||
        Array.from(displayName).length > PLAYER_DISPLAY_NAME_MAX_LENGTH
      ) {
        return {
          error: `名前を1〜${PLAYER_DISPLAY_NAME_MAX_LENGTH}文字で入力してください。`,
        };
      }
      const profileSession =
        await createNewPlayerProfileSessionCredentials();
      const newPlayer = await joinNewParticipant(
        context.group.id,
        params.gameId,
        displayName,
        tokenHash,
        profileSession.tokenHash,
        profileSession.expiresAt,
      );
      joined = newPlayer !== null;
      if (newPlayer) profileSessionToken = profileSession.token;
      if (!joined)
        return { error: "参加できませんでした。画面を更新してください。" };
    }

    const headers = new Headers();
    if (intent === "join-new") {
      headers.append(
        "Set-Cookie",
        createParticipantCookie(
          request,
          params.groupCode,
          params.gameId,
          token,
        ),
      );
    }
    if (profileSessionToken) {
      headers.append(
        "Set-Cookie",
        createPlayerProfileCookie(request, profileSessionToken),
      );
    }
    return redirect(`${participantUrl}?notice=joined`, {
      status: 303,
      headers,
    });
  }

  const token = readParticipantToken(request, params.gameId);
  const tokenHash = token ? await hashToken(token) : null;

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
    const groupPlayerId = await getAuthenticatedGroupPlayerId(
      request,
      params.groupCode,
    );
    let updated = groupPlayerId
      ? await updateParticipantInputByGroupPlayerId(
        context.group.id,
        params.gameId,
        groupPlayerId,
        remainingChips,
        rebuyCount,
      )
      : false;
    if (!updated && tokenHash) {
      updated = await updateParticipantInput(
        context.group.id,
        params.gameId,
        tokenHash,
        remainingChips,
        rebuyCount,
      );
    }
    if (!updated)
      return {
        error: "入力を保存できませんでした。受付状況を確認してください。",
      };
    return redirect(`${participantUrl}?notice=saved`, { status: 303 });
  }

  if (intent === "leave") {
    const groupPlayerId = await getAuthenticatedGroupPlayerId(
      request,
      params.groupCode,
    );
    let removed = groupPlayerId
      ? await leaveGameByGroupPlayerId(
        context.group.id,
        params.gameId,
        groupPlayerId,
      )
      : false;
    if (!removed && tokenHash) {
      removed = await leaveGame(
        context.group.id,
        params.gameId,
        tokenHash,
      );
    }
    if (!removed) {
      return { error: "参加情報を確認できません。画面を更新してください。" };
    }
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
  const revalidator = useRevalidator();
  const isSubmitting = navigation.state === "submitting";
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (loaderData.game.status !== "open") return;
    const refresh = () => {
      if (revalidator.state === "idle") void revalidator.revalidate();
    };
    window.addEventListener("pageshow", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("pageshow", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [loaderData.game.status, revalidator]);

  return (
    <main className="page-shell participant-page">
      <GroupSiteHeader
        groupCode={loaderData.group.publicCode}
        organizer={loaderData.isOrganizer}
        status={loaderData.game.status !== "finalized" ? (
          <span className={`status status-${loaderData.game.status}`}>
            {loaderData.game.status === "open" ? "受付中" : "準備中"}
          </span>
        ) : null}
      />

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

      {loaderData.game.status === "finalized" && loaderData.pastGameNavigation ? (
        <PastGameNavigation
          groupCode={loaderData.group.publicCode}
          navigation={loaderData.pastGameNavigation}
        />
      ) : null}

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
      {loaderData.notice === "finalized" ? (
        <p className="success-notice">結果を確定しました。</p>
      ) : null}
      {loaderData.notice === "corrected" ? (
        <p className="success-notice">開催情報と結果を更新しました。</p>
      ) : null}
      {loaderData.notice === "highlight-saved" ? (
        <p className="success-notice">ハイライトを保存しました。</p>
      ) : null}
      {actionData?.error ? (
        <p className="error-notice">{actionData.error}</p>
      ) : null}

      {loaderData.game.status === "finalized" ? (
        <>
          <FinalResults
            groupCode={loaderData.group.publicCode}
            lineText={loaderData.lineText}
            editUrl={
              loaderData.isOrganizer
                ? "/g/" + loaderData.group.publicCode + "/games/" + loaderData.game.id + "/admin/edit"
                : undefined
            }
            initialChips={loaderData.game.initialChips}
            playedAt={loaderData.game.playedAt}
            payPay={loaderData.payPay}
            results={loaderData.results}
            revisions={loaderData.revisions}
            shareUrl={loaderData.shareUrl}
            showSharePanel={loaderData.isOrganizer}
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
            <PlayerAvatar
              avatarUrl={loaderData.participant.avatarUrl}
              displayName={loaderData.participant.displayName}
            />
            <div>
              <p>参加中</p>
              <h2>{loaderData.participant.displayName}</h2>
            </div>
          </div>

          {loaderData.participant.status === "submitted" && !isEditing ? (
            <section className="submitted-input" aria-label="保存済みの結果">
              <div>
                <h3>SUBMITTED</h3>
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
                  defaultValue={
                    loaderData.participant.remainingChips ??
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
                      disabled={isSubmitting}
                      type="submit"
                    >
                      <PlayerAvatar
                        avatarUrl={player.avatarUrl}
                        displayName={player.displayName}
                      />
                      <span>{player.displayName}</span>
                      <small>参加</small>
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
                  maxLength={PLAYER_DISPLAY_NAME_MAX_LENGTH}
                  name="displayName"
                  placeholder="例：プレイヤー"
                  required
                />
                <span className="field-hint">最大{PLAYER_DISPLAY_NAME_MAX_LENGTH}文字</span>
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

function PastGameNavigation({
  groupCode,
  navigation,
}: {
  groupCode: string;
  navigation: NonNullable<ReturnType<typeof buildPastGameNavigation>>;
}) {
  return (
    <nav aria-label="過去の開催を移動" className="past-game-navigation">
      <PastGameNavigationItem
        direction="newer"
        game={navigation.nextGame}
        groupCode={groupCode}
      />
      <PastGameNavigationItem
        direction="older"
        game={navigation.previousGame}
        groupCode={groupCode}
      />
    </nav>
  );
}

function PastGameNavigationItem({
  direction,
  game,
  groupCode,
}: {
  direction: "newer" | "older";
  game: GameListItem | null;
  groupCode: string;
}) {
  const isNewer = direction === "newer";
  const positionClass = isNewer ? "previous" : "next";
  const arrow = <NavigationArrow direction={isNewer ? "left" : "right"} />;
  if (!game) {
    return (
      <span
        aria-hidden="true"
        className={`past-game-navigation-item is-${positionClass} is-disabled`}
      >
        {arrow}
      </span>
    );
  }

  return (
    <Link
      aria-label={`${isNewer ? "新しい" : "古い"}開催：${game.title} ${formatTokyoDateNumeric(game.playedAt)}`}
      className={`past-game-navigation-item is-${positionClass}`}
      title={game.title}
      to={`/g/${groupCode}/games/${game.id}`}
    >
      {isNewer ? arrow : null}
      <time dateTime={game.playedAt}>{formatTokyoDateNumeric(game.playedAt)}</time>
      {!isNewer ? arrow : null}
    </Link>
  );
}

function NavigationArrow({ direction }: { direction: "left" | "right" }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d={direction === "left" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} />
    </svg>
  );
}

function buildPastGameNavigation(games: GameListItem[], currentGameId: string) {
  const currentIndex = games.findIndex((game) => game.id === currentGameId);
  const currentGame = games[currentIndex];
  if (currentIndex < 0 || !currentGame) return null;
  return {
    nextGame: games[currentIndex - 1] ?? null,
    previousGame: games[currentIndex + 1] ?? null,
  };
}

async function getAuthenticatedGroupPlayerId(
  request: Request,
  groupCode: string,
): Promise<string | null> {
  const overview = await getAuthenticatedPlayerProfile(request, groupCode);
  return overview?.profile?.groupPlayerId ?? null;
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
