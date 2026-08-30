import {
  Form,
  Link,
  redirect,
  useFetcher,
  useNavigation,
  useRevalidator,
} from "react-router";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
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
  findParticipantByTokenHash,
  joinAuthenticatedParticipant,
  joinNewParticipant,
  leaveGame,
  leaveGameByGroupPlayerId,
  listCurrentGameParticipants,
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
import { encodeResultCode } from "@domain/result-sharing/result-code";
import { PLAYER_DISPLAY_NAME_MAX_LENGTH } from "@domain/player-profile/validate-player-profile";
import { FinalResults } from "../components/final-results";
import { PlayerAvatar } from "../components/player-avatar";
import { PlayerChoiceList } from "~/components/player-choice-list";
import {
  createNewPlayerProfileSessionCredentials,
  getAuthenticatedPlayerIdentity,
  getAuthenticatedPlayerProfile,
  selectPlayerProfile,
} from "@server/services/player-profile-service.server";
import {
  joinCurrentProfileToGroupGame,
  joinSelfParticipant,
} from "@server/services/participant-service.server";
import {
  recordOwnRebuyAction,
  undoOwnRebuyAction,
  type RebuyServiceResult,
} from "@server/services/rebuy-service.server";
import { buildPlayerAvatarUrl } from "@domain/player-profile/build-player-avatar-url";
import { createPlayerProfileCookie } from "@server/services/player-profile-session.server";
import { GameStories } from "../components/game-stories";
import { GroupSiteHeader } from "~/components/site-menu";
import { GroupInviteJoinPanel } from "~/components/group-invite-join-panel";
import {
  isOrganizerAuthenticated,
  requireOrganizer,
} from "@server/services/organizer-auth.server";
import { isPayPayLinkActive } from "@domain/payment/paypay-link";
import { findGamePaymentAmountForPlayer } from "@server/repositories/group-paypay-repository.server";
import type { GameListItem, GameStatus } from "@shared-types/game";
import type { Route } from "./+types/game-participant";
import { formatTokyoDateNumeric } from "@domain/date/format-tokyo-date";
import { createCommandId } from "~/utils/create-command-id";
import {
  buildGameStoryPhotoUrl,
  deleteGameStoryPostAsOrganizer,
  getOwnGameStoryPost,
  getPublishedGameStoryPosts,
  saveFinalizedGameStory,
} from "@server/services/game-story-service.server";
import { buildLocalRules } from "@domain/rules/local-rules";
import {
  listGameCostShareReceipts,
} from "@server/repositories/game-cost-share-receipt-repository.server";
import { updateGameCostShareReceipt } from "@server/services/game-cost-share-receipt-service.server";
import { OrganizerCostShareCollection } from "~/components/organizer-cost-share-collection";
import { buildSettlementPreviewDraftStorageKey } from "~/utils/settlement-preview-draft";
import { INVITE_REQUIRED_RESPONSE_TEXT } from "@domain/routing/public-group-entry";

type RebuyActionIntent = "record-rebuy" | "record-repayment" | "undo-rebuy";
type RebuyActionData = RebuyServiceResult & { intent: RebuyActionIntent };

export type UndoableRebuyAction = {
  eventId: string;
  intent: "record-rebuy" | "record-repayment";
};

export async function loader({ request, params }: Route.LoaderArgs) {
  const context = await requireGame(params.groupCode, params.gameId);
  const [isOrganizer, profileOverview] = await Promise.all([
    isOrganizerAuthenticated(request),
    getAuthenticatedPlayerProfile(request, params.groupCode),
  ]);

  if (
    context.game.status !== "open" &&
    !isOrganizer &&
    !profileOverview?.profile
  ) {
    throw new Response(INVITE_REQUIRED_RESPONSE_TEXT, { status: 403 });
  }

  const url = new URL(request.url);
  const participantToken = readParticipantToken(request, params.gameId);
  const participantTokenHash = participantToken
    ? await hashToken(participantToken)
    : null;
  const [participant, participantRoster] = await Promise.all([
    profileOverview?.profile
      ? findParticipantByGroupPlayerId(
        context.group.id,
        params.gameId,
        profileOverview.profile.groupPlayerId,
      )
      : participantTokenHash
        ? findParticipantByTokenHash(
            context.group.id,
            params.gameId,
            participantTokenHash,
          )
        : Promise.resolve(null),
    context.game.status === "open"
      ? listCurrentGameParticipants(context.group.id, params.gameId)
        .then((participants) => ({ available: true, participants }))
        .catch(() => ({ available: false, participants: [] }))
      : Promise.resolve({ available: true, participants: [] }),
  ]);
  const groupInvitePlayer =
    context.game.status === "open" &&
    !participant &&
    !profileOverview?.profile
      ? await getAuthenticatedPlayerIdentity(request)
      : null;
  const players =
    context.game.status === "open" && !participant && !groupInvitePlayer
      ? await listRegisteredPlayersForGame(context.group.id, params.gameId)
      : [];
  const ownStoryPost =
    participant && context.game.status === "finalized"
      ? await getOwnGameStoryPost(
        context.group.id,
        params.gameId,
        participant.id,
      )
      : null;
  const results =
    context.game.status === "finalized"
      ? await listFinalResults(context.group.id, params.gameId)
      : [];
  const costShareReceipts =
    context.game.status === "finalized" && isOrganizer
      ? await listGameCostShareReceipts(context.group.id, params.gameId)
      : [];
  const revisions =
    context.game.status === "finalized"
      ? await listResultRevisions(context.group.id, params.gameId)
      : [];
  const storyPosts =
    context.game.status === "finalized"
      ? await getPublishedGameStoryPosts(context.group.id, params.gameId)
      : [];
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
    groupInvitePlayer: groupInvitePlayer
      ? { displayName: groupInvitePlayer.displayName }
      : null,
    authenticatedPlayer: profileOverview?.profile
      ? {
        avatarUrl: buildPlayerAvatarUrl({
          avatarUpdatedAt: profileOverview.profile.avatarUploadedAt,
          groupCode: params.groupCode,
          groupPlayerId: profileOverview.profile.groupPlayerId,
        }),
        displayName: profileOverview.profile.displayName,
        groupPlayerId: profileOverview.profile.groupPlayerId,
      }
      : null,
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
    participantRoster: {
      available: participantRoster.available,
      items: participantRoster.participants.map((currentParticipant) => ({
        displayName: currentParticipant.displayName,
        isCurrentUser:
          currentParticipant.groupPlayerId ===
          participant?.groupPlayerId,
      })),
    },
    players: players.map((player) => ({
      ...player,
      avatarUrl: buildPlayerAvatarUrl({
        avatarUpdatedAt: player.avatarUpdatedAt,
        groupCode: params.groupCode,
        groupPlayerId: player.id,
      }),
    })),
    results,
    costShareReceipts,
    revisions,
    ownStoryPost,
    ownStoryPhotoUrl: ownStoryPost
      ? buildGameStoryPhotoUrl({
        gameId: params.gameId,
        groupCode: params.groupCode,
        post: ownStoryPost,
      })
      : null,
    storyPosts: storyPosts.map((post) => ({
      ...post,
      avatarUrl: buildPlayerAvatarUrl({
        avatarUpdatedAt: post.avatarUpdatedAt,
        groupCode: params.groupCode,
        groupPlayerId: post.groupPlayerId,
      }),
      photoUrl: buildGameStoryPhotoUrl({
        gameId: params.gameId,
        groupCode: params.groupCode,
        post,
      }),
    })),
    lineText:
      results.length > 0
        ? formatLineResult(
          context.game.title,
          results,
          context.game.initialChips,
        )
        : "",
    shareUrl: `${url.origin}/r/${encodeResultCode(params.gameId)}`,
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

  if (intent === "update-cost-share-receipt") {
    await requireOrganizer(request, params.groupCode);
    const groupPlayerId = readString(formData, "groupPlayerId");
    const receivedValue = readString(formData, "received");
    if (
      !isUuid(groupPlayerId) ||
      (receivedValue !== "yes" && receivedValue !== "no")
    ) {
      throw new Response("Bad Request", { status: 400 });
    }
    const received = receivedValue === "yes";
    const result = await updateGameCostShareReceipt(
      context.group.id,
      params.gameId,
      groupPlayerId,
      received,
    );
    return {
      ...result,
      intent: "update-cost-share-receipt" as const,
      groupPlayerId,
      received,
    };
  }

  if (intent === "delete-story-post") {
    await requireOrganizer(request, params.groupCode);
    const postId = readString(formData, "postId");
    if (!isUuid(postId)) throw new Response("Bad Request", { status: 400 });
    const deleted = await deleteGameStoryPostAsOrganizer(
      context.group.id,
      params.gameId,
      postId,
    );
    if (!deleted) return { error: "投稿を削除できませんでした。" };
    return redirect(`${participantUrl}?notice=story-deleted`, { status: 303 });
  }

  if (intent === "save-story-post") {
    if (context.game.status !== "finalized") {
      return { error: "確定済みの開催だけに投稿できます。" };
    }
    const groupPlayerId = await getAuthenticatedGroupPlayerId(
      request,
      params.groupCode,
    );
    const participantToken = readParticipantToken(request, params.gameId);
    const target = groupPlayerId
      ? { kind: "group-player-id" as const, value: groupPlayerId }
      : participantToken
        ? {
            kind: "participant-token" as const,
            value: await hashToken(participantToken),
          }
        : null;
    if (!target) {
      return { error: "この開催への参加状態を確認できませんでした。" };
    }
    const photoEntry = formData.get("storyPhoto");
    const storyBody = readString(formData, "storyBody");
    const removeStoryPhoto =
      readString(formData, "removeStoryPhoto") === "yes";
    const isDeletingOwnStory =
      storyBody.trim() === "" &&
      removeStoryPhoto &&
      !(photoEntry instanceof File && photoEntry.size > 0);
    const result = await saveFinalizedGameStory(
      context.group.id,
      params.gameId,
      {
        body: storyBody,
        photo:
          photoEntry instanceof File && photoEntry.size > 0 ? photoEntry : null,
        removePhoto: removeStoryPhoto,
        target,
      },
    );
    if (!result.ok) return { error: result.error };
    return redirect(
      `${participantUrl}?notice=${isDeletingOwnStory ? "story-deleted" : "story-saved"}`,
      { status: 303 },
    );
  }

  if (intent === "join-current-profile-to-group") {
    if (context.game.status !== "open") {
      return { error: "現在は参加を受け付けていません。" };
    }
    const joined = await joinCurrentProfileToGroupGame(request, {
      gameId: params.gameId,
      groupId: context.group.id,
    });
    if (!joined.ok) return { error: joined.error };
    return redirect(participantUrl + "?notice=group-joined", { status: 303 });
  }

  if (intent === "join-self") {
    if (context.game.status !== "open") {
      return { error: "現在は参加を受け付けていません。" };
    }
    const joined = await joinSelfParticipant(request, {
      gameId: params.gameId,
      groupCode: params.groupCode,
      groupId: context.group.id,
    });
    if (!joined.ok) return { error: joined.error };
    return redirect(`${participantUrl}?notice=joined`, { status: 303 });
  }

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

  if (
    intent === "record-rebuy" ||
    intent === "record-repayment" ||
    intent === "undo-rebuy"
  ) {
    const commandId = readString(formData, "commandId");
    const result =
      intent === "undo-rebuy"
        ? await undoOwnRebuyAction(request, {
          commandId,
          eventId: readString(formData, "eventId"),
          gameId: params.gameId,
          groupCode: params.groupCode,
          groupId: context.group.id,
        })
        : await recordOwnRebuyAction(request, {
          actionType: intent === "record-rebuy" ? "rebuy" : "repayment",
          commandId,
          gameId: params.gameId,
          groupCode: params.groupCode,
          groupId: context.group.id,
        });
    return { ...result, intent };
  }

  const token = readParticipantToken(request, params.gameId);
  const tokenHash = token ? await hashToken(token) : null;

  if (intent === "save-input") {
    const remainingChips = parseNonNegativeInteger(
      readString(formData, "remainingChips"),
    );
    const settlementRebuyCount = parseNonNegativeInteger(
      readString(formData, "settlementRebuyCount"),
    );
    if (remainingChips === null || settlementRebuyCount === null) {
      return {
        error: "残りチップとリバイ証は0以上の整数で入力してください。",
      };
    }
    const groupPlayerId = await getAuthenticatedGroupPlayerId(
      request,
      params.groupCode,
    );
    const target = groupPlayerId
      ? { kind: "group-player-id" as const, value: groupPlayerId }
      : tokenHash
        ? { kind: "participant-token" as const, value: tokenHash }
        : null;
    if (!target) {
      return {
        error: "入力を保存できませんでした。受付状況を確認してください。",
      };
    }
    const updated = target.kind === "group-player-id"
      ? await updateParticipantInputByGroupPlayerId(
        context.group.id,
        params.gameId,
        target.value,
        remainingChips,
        settlementRebuyCount,
      )
      : await updateParticipantInput(
        context.group.id,
        params.gameId,
        target.value,
        remainingChips,
        settlementRebuyCount,
      );
    if (!updated) {
      return {
        error: "入力を保存できませんでした。受付状況を確認してください。",
      };
    }
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
  const rebuyFetcher = useFetcher<RebuyActionData>();
  const revalidator = useRevalidator();
  const isSubmitting = navigation.state === "submitting";
  const [isEditing, setIsEditing] = useState(false);
  const noticeMessage = getParticipantNotice(loaderData.notice);
  const [showNoticeToast, setShowNoticeToast] = useState(Boolean(noticeMessage));

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

  useEffect(() => {
    if (loaderData.notice !== "finalized") return;
    try {
      window.localStorage.removeItem(
        buildSettlementPreviewDraftStorageKey(
          loaderData.group.publicCode,
          loaderData.game.id,
        ),
      );
    } catch {
      // Finalization already succeeded; blocked local storage must not affect results.
    }
  }, [
    loaderData.game.id,
    loaderData.group.publicCode,
    loaderData.notice,
  ]);

  useEffect(() => {
    if (!noticeMessage) {
      setShowNoticeToast(false);
      return;
    }
    setShowNoticeToast(true);
    const url = new URL(window.location.href);
    url.searchParams.delete("notice");
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
    const timer = window.setTimeout(() => setShowNoticeToast(false), 3000);
    return () => window.clearTimeout(timer);
  }, [noticeMessage]);

  return (
    <main
      className={`page-shell participant-page${loaderData.game.status === "open" && !loaderData.participant
          ? " participant-selection-page"
          : ""
        }`}
    >
      <GroupSiteHeader
        groupCode={loaderData.group.publicCode}
        organizer={loaderData.isOrganizer}
      />

      <section className="participant-hero">
        <p className="participant-hero-status">
          {loaderData.game.status === "finalized" ? "RESULTS" : "AT THE TABLE"}
        </p>
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

      {shouldShowLocalRules(loaderData.game.status) ? (
        <LocalRulesSheet
          bombPotRuleEnabled={loaderData.game.bombPotRuleEnabled}
          sevenDeuceRuleEnabled={loaderData.game.sevenDeuceRuleEnabled}
        />
      ) : null}

      {loaderData.game.status === "finalized" && loaderData.pastGameNavigation ? (
        <PastGameNavigation
          groupCode={loaderData.group.publicCode}
          navigation={loaderData.pastGameNavigation}
        />
      ) : null}

      {showNoticeToast && noticeMessage ? (
        <div className="app-toast" role="status">
          <span aria-hidden="true">✓</span>
          {noticeMessage}
        </div>
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
          {loaderData.isOrganizer ? (
            <OrganizerCostShareCollection
              receipts={loaderData.costShareReceipts}
            />
          ) : null}
          <GameStories
            canPost={Boolean(loaderData.participant)}
            initialChips={loaderData.game.initialChips}
            isOrganizer={loaderData.isOrganizer}
            ownPhotoUrl={loaderData.ownStoryPhotoUrl}
            ownPost={loaderData.ownStoryPost}
            posts={loaderData.storyPosts}
            results={loaderData.results}
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
        <section className="participant-panel participant-session">
          <div className="participant-session-header">
            <div className="participant-identity">
              <PlayerAvatar
                avatarUrl={loaderData.participant.avatarUrl}
                displayName={loaderData.participant.displayName}
              />
              <div>
                <p>YOU ARE SEATED</p>
                <h2>{loaderData.participant.displayName}</h2>
              </div>
            </div>
            <div className="participant-session-state">
              <strong>
                {loaderData.participant.status === "submitted"
                  ? "入力済み"
                  : "ゲーム中"}
              </strong>
              <small>
                {loaderData.participant.status === "submitted"
                  ? "主催者の確定待ち"
                  : "参加済み"}
              </small>
            </div>
          </div>

          <ParticipantRosterSheet
            available={loaderData.participantRoster.available}
            items={loaderData.participantRoster.items}
            onOpen={() => {
              if (revalidator.state === "idle") {
                void revalidator.revalidate();
              }
            }}
          />

          <section className="participant-phase participant-phase-live">
            <div className="participant-phase-heading">
              <div>
                <span className="participant-phase-label">プレイ中</span>
                <h3>リバイ</h3>
                <p>リバイと100BB返済を、その場で記録します。</p>
              </div>
            </div>
            <RebuyTracker
              canRecord={loaderData.participant.status !== "locked"}
              fetcher={rebuyFetcher}
              outstandingRebuyCount={
                loaderData.participant.outstandingRebuyCount
              }
              totalRebuyCount={loaderData.participant.totalRebuyCount}
            />
          </section>

          {loaderData.participant.status === "submitted" && !isEditing ? (
            <section
              className="participant-phase participant-phase-after"
              aria-label="保存済みの結果"
            >
              <div className="participant-phase-heading">
                <div>
                  <span className="participant-phase-label">ゲーム終了後</span>
                  <h3>入力済み</h3>
                  <p>主催者の確定待ちです。確定までは修正できます。</p>
                </div>
              </div>
              <div className="submitted-input">
                <div className="submitted-input-values rebuy-submitted-values">
                  <div>
                    <span>残りチップ</span>
                    <strong>
                      {loaderData.participant.remainingChips?.toLocaleString(
                        "ja-JP",
                      ) ?? 0}
                    </strong>
                  </div>
                  <div>
                    <span>累計リバイ</span>
                    <strong>
                      {formatTotalRebuyCount(
                        loaderData.participant.totalRebuyCount,
                      )}
                    </strong>
                  </div>
                  <div>
                    <span>終了時リバイ証</span>
                    <strong>
                      {loaderData.participant.settlementRebuyCount ?? 0}枚
                    </strong>
                  </div>
                </div>
                <RebuyMatchStatus
                  outstandingRebuyCount={
                    loaderData.participant.outstandingRebuyCount
                  }
                  settlementRebuyCount={
                    loaderData.participant.settlementRebuyCount ?? 0
                  }
                />
                <button
                  className="button button-secondary"
                  onClick={() => setIsEditing(true)}
                  type="button"
                >
                  修正する
                </button>
              </div>
            </section>
          ) : (
            <ParticipantResultEntrySection>
              <ResultEntryForm
                initialChips={loaderData.game.initialChips}
                isSubmitting={isSubmitting}
                outstandingRebuyCount={
                  loaderData.participant.outstandingRebuyCount
                }
                remainingChips={loaderData.participant.remainingChips}
                settlementRebuyCount={
                  loaderData.participant.settlementRebuyCount
                }
                totalRebuyCount={loaderData.participant.totalRebuyCount}
              />
            </ParticipantResultEntrySection>
          )}

          <ParticipantLeaveControl isSubmitting={isSubmitting} />
        </section>
      ) : (
        <div
          className={
            loaderData.authenticatedPlayer || loaderData.groupInvitePlayer
              ? "join-grid"
              : "player-selection"
          }
        >
          {loaderData.authenticatedPlayer ? (
            <section className="participant-panel">
              <div className="participant-identity">
                <PlayerAvatar
                  avatarUrl={loaderData.authenticatedPlayer.avatarUrl}
                  displayName={loaderData.authenticatedPlayer.displayName}
                />
                <div>
                  <p>本人プロフィール</p>
                  <h2>{loaderData.authenticatedPlayer.displayName}</h2>
                </div>
              </div>
              <Form method="post" reloadDocument>
                <input name="intent" type="hidden" value="join-self" />
                <button
                  className="button button-primary"
                  disabled={isSubmitting}
                  type="submit"
                >
                  {loaderData.authenticatedPlayer.displayName}として登録する
                </button>
              </Form>
            </section>
          ) : loaderData.groupInvitePlayer ? (
            <GroupInviteJoinPanel
              displayName={loaderData.groupInvitePlayer.displayName}
              groupName={loaderData.group.name}
              isSubmitting={isSubmitting}
            />
          ) : (
            <>
              <section className="player-selection-primary">
                <div className="section-heading compact-heading">
                  <div>
                    <p className="eyebrow">JOIN THE TABLE</p>
                    <h2>参加する名前を選択</h2>
                  </div>
                </div>
                <p className="muted-copy">
                  自分の名前を選び、確認して今回のゲームへ参加します。
                </p>
                {loaderData.players.length === 0 ? (
                  <p className="muted-copy">登録済みメンバーはまだいません。</p>
                ) : (
                  <PlayerChoiceList
                    actionLabel="参加"
                    confirmBeforeSubmit
                    intent="join-existing"
                    isSubmitting={isSubmitting}
                    players={loaderData.players}
                    reloadDocument
                  />
                )}
              </section>

              <section className="player-selection-create">
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
            </>
          )}
        </div>
      )}
    </main>
  );
}

function ParticipantLeaveControl({
  isSubmitting,
}: {
  isSubmitting: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  function closeDialog() {
    setIsOpen(false);
  }

  function handleDialogClose() {
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <>
      <button
        aria-controls="participant-leave-dialog"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className="text-button danger-text participant-leave-trigger"
        disabled={isSubmitting}
        onClick={() => setIsOpen(true)}
        ref={triggerRef}
        type="button"
      >
        参加を取り消す
      </button>
      <dialog
        aria-labelledby="participant-leave-title"
        className="app-dialog"
        id="participant-leave-dialog"
        onCancel={closeDialog}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeDialog();
        }}
        onClose={handleDialogClose}
        ref={dialogRef}
      >
        <div className="dialog-card">
          <span aria-hidden="true" className="dialog-danger-icon">
            !
          </span>
          <div>
            <p className="eyebrow">LEAVE GAME</p>
            <h2 id="participant-leave-title">参加を取り消しますか？</h2>
            <p>
              この開催の参加状態、リバイ記録、終了時入力が削除されます。
              プレイヤープロフィールは削除されません。
            </p>
          </div>
          <div className="dialog-actions">
            <button
              autoFocus
              className="button button-secondary"
              onClick={closeDialog}
              type="button"
            >
              キャンセル
            </button>
            <Form method="post" reloadDocument>
              <input name="intent" type="hidden" value="leave" />
              <button
                className="button button-danger"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? "取消中…" : "参加を取り消す"}
              </button>
            </Form>
          </div>
        </div>
      </dialog>
    </>
  );
}

interface ParticipantRosterItem {
  displayName: string;
  isCurrentUser: boolean;
}

export function ParticipantRosterSheet({
  available,
  items,
  onOpen,
}: {
  available: boolean;
  items: ParticipantRosterItem[];
  onOpen?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const countLabel = available ? String(items.length) : "—";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  function closeSheet() {
    setIsOpen(false);
  }

  function handleDialogClose() {
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  function openSheet() {
    onOpen?.();
    setIsOpen(true);
  }

  return (
    <>
      <button
        aria-controls="participant-roster-dialog"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className="participant-roster-trigger"
        onClick={openSheet}
        ref={triggerRef}
        type="button"
      >
        <span>
          参加者 <strong>{countLabel}</strong>
        </span>
        <small>一覧を見る</small>
      </button>
      <dialog
        aria-labelledby="participant-roster-title"
        className="app-dialog participant-roster-dialog"
        id="participant-roster-dialog"
        onCancel={closeSheet}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeSheet();
        }}
        onClose={handleDialogClose}
        ref={dialogRef}
      >
        <div className="participant-roster-sheet">
          <header className="participant-roster-header">
            <div>
              <p className="eyebrow">CURRENT PLAYERS</p>
              <h2 id="participant-roster-title">
                参加者 {countLabel}
              </h2>
            </div>
            <button
              aria-label="参加者一覧を閉じる"
              className="participant-roster-close"
              onClick={closeSheet}
              type="button"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </header>
          <div className="participant-roster-scroll">
            {!available ? (
              <p className="participant-roster-empty" role="status">
                参加者一覧を読み込めませんでした。
              </p>
            ) : items.length === 0 ? (
              <p className="participant-roster-empty">参加者はいません</p>
            ) : (
              <ul className="participant-roster-list">
                {items.map((item, index) => (
                  <li key={item.displayName + "-" + index}>
                    <span>{item.displayName}</span>
                    {item.isCurrentUser ? (
                      <small className="participant-roster-you">あなた</small>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}


export function LocalRulesSheet({
  bombPotRuleEnabled,
  sevenDeuceRuleEnabled,
}: {
  bombPotRuleEnabled: boolean;
  sevenDeuceRuleEnabled: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  function closeSheet() {
    setIsOpen(false);
  }

  function handleDialogClose() {
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  const rules = buildLocalRules(
    sevenDeuceRuleEnabled,
    bombPotRuleEnabled,
  );

  return (
    <div className="local-rules-entry">
      <button
        aria-controls="local-rules-dialog"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className="rebuy-rules-trigger local-rules-trigger"
        onClick={() => setIsOpen(true)}
        ref={triggerRef}
        type="button"
      >
        <span>ローカルルールを確認</span>
        <span aria-hidden="true">›</span>
      </button>
      <dialog
        aria-describedby="local-rules-description"
        aria-labelledby="local-rules-title"
        className="app-dialog participant-roster-dialog rebuy-rules-dialog"
        id="local-rules-dialog"
        onCancel={closeSheet}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeSheet();
        }}
        onClose={handleDialogClose}
        ref={dialogRef}
      >
        <div className="participant-roster-sheet rebuy-rules-sheet">
          <header className="participant-roster-header">
            <div>
              <p className="eyebrow">LOCAL RULES</p>
              <h2 id="local-rules-title">ローカルルール</h2>
            </div>
            <button
              aria-label="ローカルルールを閉じる"
              className="participant-roster-close"
              onClick={closeSheet}
              type="button"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </header>
          <div
            className="participant-roster-scroll rebuy-rules-content local-rules-content"
            id="local-rules-description"
          >
            {rules.map((rule) => (
              <section
                className={`local-rule-card${rule.enabled ? "" : " is-disabled"}`}
                key={rule.key}
              >
                <header>
                  <h3>{rule.title}</h3>
                  <span>{rule.enabled ? "適用中" : "OFF"}</span>
                </header>
                <ol className="rebuy-rules-list">
                  {rule.steps.map((step) => (
                    <li key={step.label}>
                      <strong>{step.label}</strong>
                      <span>{step.text}</span>
                    </li>
                  ))}
                </ol>
                {rule.note ? (
                  <p className="rebuy-rules-note">{rule.note}</p>
                ) : null}
              </section>
            ))}
          </div>
        </div>
      </dialog>
    </div>
  );
}

export function shouldShowLocalRules(status: GameStatus): boolean {
  return status !== "finalized";
}

function RebuyTracker({
  canRecord,
  fetcher,
  outstandingRebuyCount,
  totalRebuyCount,
}: {
  canRecord: boolean;
  fetcher: ReturnType<typeof useFetcher<RebuyActionData>>;
  outstandingRebuyCount: number;
  totalRebuyCount: number | null;
}) {
  const isPending = fetcher.state !== "idle";
  const result = fetcher.data;
  const submissionPendingRef = useRef(false);
  const [undoableAction, setUndoableAction] =
    useState<UndoableRebuyAction | null>(null);

  useEffect(() => {
    if (fetcher.state === "idle") submissionPendingRef.current = false;
  }, [fetcher.state]);

  useEffect(() => {
    setUndoableAction((current) =>
      resolveUndoableRebuyAction(current, result),
    );
  }, [result]);

  function submit(intent: "record-rebuy" | "record-repayment") {
    if (submissionPendingRef.current) return;
    submissionPendingRef.current = true;
    void fetcher.submit(
      { commandId: createCommandId(), intent },
      { method: "post" },
    );
  }

  function undo() {
    if (!undoableAction) return;
    if (submissionPendingRef.current) return;
    submissionPendingRef.current = true;
    void fetcher.submit(
      {
        commandId: createCommandId(),
        eventId: undoableAction.eventId,
        intent: "undo-rebuy",
      },
      { method: "post" },
    );
  }

  const feedbackMessage =
    undoableAction?.intent === "record-rebuy"
      ? "直前：＋ リバイ"
      : undoableAction?.intent === "record-repayment"
        ? "直前：100BB返済"
        : null;

  return (
    <section className="rebuy-tracker" aria-labelledby="rebuy-tracker-title">
      <div className="rebuy-tracker-heading">
        <h3 id="rebuy-tracker-title">現在の記録</h3>
        {!canRecord ? <span className="rebuy-tracker-locked">編集不可</span> : null}
      </div>
      <div className="rebuy-state-grid">
        <div>
          <span>累計リバイ</span>
          <strong>{formatTotalRebuyCount(totalRebuyCount)}</strong>
        </div>
        <div>
          <span>未返済</span>
          <strong>
            {outstandingRebuyCount}口
            <small> / {outstandingRebuyCount * 100}BB</small>
          </strong>
        </div>
      </div>
      {canRecord ? (
        <div className="rebuy-actions">
          <button
            className="button button-primary"
            disabled={isPending}
            onClick={() => submit("record-rebuy")}
            type="button"
          >
            {isPending && fetcher.formData?.get("intent") === "record-rebuy"
              ? "記録中…"
              : "＋ リバイ"}
          </button>
          <button
            className="button button-secondary"
            disabled={isPending || outstandingRebuyCount === 0}
            onClick={() => submit("record-repayment")}
            type="button"
          >
            {isPending &&
              fetcher.formData?.get("intent") === "record-repayment"
              ? "返済中…"
              : "100BB返済"}
          </button>
        </div>
      ) : (
        <p className="rebuy-tracker-help">
          このリバイ記録は現在変更できません。
        </p>
      )}
      {result?.ok === false ? (
        <p className="rebuy-action-error" role="alert">
          {result.error}
        </p>
      ) : null}
      {feedbackMessage ? (
        <div
          aria-live="polite"
          className="rebuy-action-feedback"
          role="status"
        >
          <span className="rebuy-action-feedback-copy">
            <span aria-hidden="true">✓</span>
            <strong>{feedbackMessage}</strong>
          </span>
          <button
            className="rebuy-inline-undo"
            disabled={isPending}
            onClick={undo}
            type="button"
          >
            <span aria-hidden="true">↶</span>
            元に戻す
          </button>
        </div>
      ) : null}
    </section>
  );
}

export function resolveUndoableRebuyAction(
  current: UndoableRebuyAction | null,
  result: RebuyActionData | undefined,
): UndoableRebuyAction | null {
  if (!result?.ok) return current;
  if (result.intent === "undo-rebuy") return null;
  if (!result.eventId) return current;
  return { eventId: result.eventId, intent: result.intent };
}

function ResultEntryForm({
  initialChips,
  isSubmitting,
  outstandingRebuyCount,
  remainingChips,
  settlementRebuyCount,
  totalRebuyCount,
}: {
  initialChips: number;
  isSubmitting: boolean;
  outstandingRebuyCount: number;
  remainingChips: number | null;
  settlementRebuyCount: number | null;
  totalRebuyCount: number | null;
}) {
  const [reportedCount, setReportedCount] = useState(
    settlementRebuyCount ?? outstandingRebuyCount,
  );
  const reportedCountEditedRef = useRef(settlementRebuyCount !== null);

  useEffect(() => {
    if (settlementRebuyCount !== null) {
      reportedCountEditedRef.current = true;
      setReportedCount(settlementRebuyCount);
      return;
    }
    if (!reportedCountEditedRef.current) {
      setReportedCount(outstandingRebuyCount);
    }
  }, [outstandingRebuyCount, settlementRebuyCount]);

  return (
    <Form
      className="result-entry-form"
      method="post"
      noValidate
    >
      <input name="intent" type="hidden" value="save-input" />
      <label className="field">
        <span className="field-label">残りチップ（枚）</span>
        <input
          defaultValue={remainingChips ?? initialChips}
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
          inputMode="numeric"
          min={0}
          name="settlementRebuyCount"
          onChange={(event) => {
            reportedCountEditedRef.current = true;
            const value = Number(event.currentTarget.value);
            if (Number.isSafeInteger(value) && value >= 0) {
              setReportedCount(value);
            }
          }}
          required
          type="number"
          value={reportedCount}
        />
        <span className="field-hint">終了時に手元に残っている枚数</span>
      </label>
      <div className="result-rebuy-check">
        <div>
          <span>今日の累計リバイ</span>
          <strong>{formatTotalRebuyCount(totalRebuyCount)}</strong>
        </div>
        <RebuyMatchStatus
          outstandingRebuyCount={outstandingRebuyCount}
          settlementRebuyCount={reportedCount}
        />
      </div>
      <button
        className="button button-primary"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "保存中…" : "結果を保存"}
      </button>
    </Form>
  );
}

export function ParticipantResultEntrySection({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <section
      aria-label="ゲーム終了時の入力"
      className="participant-phase participant-phase-after participant-after-entry"
    >
      <div className="participant-phase-heading">
        <span className="participant-phase-label">ゲーム終了後</span>
        <div>
          <h3>最終結果を入力</h3>
          <p>
            ゲームが終了したら、残りチップと手元のリバイ証を入力します。
          </p>
        </div>
      </div>
      <div className="participant-after-entry-body">{children}</div>
    </section>
  );
}

function getParticipantNotice(notice: string | null): string | null {
  const messages: Record<string, string> = {
    joined: "参加しました。ゲーム中の操作を開始できます。",
    "group-joined": "グループに参加し、この開催へ登録しました。",
    saved: "最終結果を保存しました。",
    "story-saved": "TABLE STORIESへの投稿を保存しました。",
    "story-deleted": "投稿を削除しました。",
    left: "参加を取り消しました。",
    finalized: "結果を確定しました。",
    corrected: "開催情報と結果を更新しました。",
  };
  return notice ? messages[notice] ?? null : null;
}

function RebuyMatchStatus({
  outstandingRebuyCount,
  settlementRebuyCount,
}: {
  outstandingRebuyCount: number;
  settlementRebuyCount: number;
}) {
  const matched = outstandingRebuyCount === settlementRebuyCount;
  return (
    <p className={matched ? "rebuy-match-status is-matched" : "rebuy-match-status has-mismatch"}>
      <strong>
        {matched
          ? "✓ リバイ記録と一致しています"
          : "! リバイ記録とリバイ証が一致しません"}
      </strong>
      <small>
        記録上の未返済 {outstandingRebuyCount}口 / リバイ証 {settlementRebuyCount}枚
      </small>
    </p>
  );
}

function formatTotalRebuyCount(value: number | null): string {
  return value === null ? "記録なし" : `${value}回`;
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
