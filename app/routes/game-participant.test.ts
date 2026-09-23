import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { encodeResultCode } from "@domain/result-sharing/result-code";

const mocked = vi.hoisted(() => ({
  createNewPlayerProfileSessionCredentials: vi.fn(),
  createParticipantCookie: vi.fn(),
  createPlayerProfileCookie: vi.fn(),
  findGameForGroup: vi.fn(),
  findGameWithGroupByPublicCode: vi.fn(),
  findGamePaymentAmountForPlayer: vi.fn(),
  findGroupByPublicCode: vi.fn(),
  findParticipantByGroupPlayerId: vi.fn(),
  findParticipantByTokenHash: vi.fn(),
  getOpenGameTableEventCounts: vi.fn(),
  getAuthenticatedPlayerIdentity: vi.fn(),
  getAuthenticatedPlayerProfile: vi.fn(),
  getOwnGameStoryPost: vi.fn(),
  getPublishedGameStoryPosts: vi.fn(),
  isOrganizerAuthenticated: vi.fn(),
  joinAuthenticatedParticipant: vi.fn(),
  joinExistingPlayerToGroupGame: vi.fn(),
  joinNewParticipant: vi.fn(),
  leaveGame: vi.fn(),
  leaveGameByGroupPlayerId: vi.fn(),
  listFinalResults: vi.fn(),
  listGameCostShareReceipts: vi.fn(),
  listGamesForGroup: vi.fn(),
  listCurrentGameParticipants: vi.fn(),
  listRegisteredPlayersForGame: vi.fn(),
  listResultRevisions: vi.fn(),
  listOpenGameTableEvents: vi.fn(),
  selectPlayerProfile: vi.fn(),
  saveFinalizedGameStory: vi.fn(),
  deleteGameStoryPostAsOrganizer: vi.fn(),
  requireOrganizer: vi.fn(),
  recordOwnRebuyAction: vi.fn(),
  undoOwnRebuyAction: vi.fn(),
  updateParticipantInput: vi.fn(),
  updateParticipantInputByGroupPlayerId: vi.fn(),
  updateGameCostShareReceipt: vi.fn(),
}));

vi.mock("@server/repositories/game-repository.server", () => ({
  findGameForGroup: mocked.findGameForGroup,
  findGameWithGroupByPublicCode: mocked.findGameWithGroupByPublicCode,
  listGamesForGroup: mocked.listGamesForGroup,
}));
vi.mock("@server/repositories/group-repository.server", () => ({
  findGroupByPublicCode: mocked.findGroupByPublicCode,
}));
vi.mock("@server/repositories/finalization-repository.server", () => ({
  listFinalResults: mocked.listFinalResults,
  listResultRevisions: mocked.listResultRevisions,
}));
vi.mock("@server/repositories/participant-repository.server", () => ({
  findParticipantByGroupPlayerId: mocked.findParticipantByGroupPlayerId,
  findParticipantByTokenHash: mocked.findParticipantByTokenHash,
  getOpenGameTableEventCounts: mocked.getOpenGameTableEventCounts,
  joinAuthenticatedParticipant: mocked.joinAuthenticatedParticipant,
  joinExistingPlayerToGroupGame: mocked.joinExistingPlayerToGroupGame,
  joinNewParticipant: mocked.joinNewParticipant,
  leaveGame: mocked.leaveGame,
  leaveGameByGroupPlayerId: mocked.leaveGameByGroupPlayerId,
  listCurrentGameParticipants: mocked.listCurrentGameParticipants,
  listRegisteredPlayersForGame: mocked.listRegisteredPlayersForGame,
  updateParticipantInput: mocked.updateParticipantInput,
  updateParticipantInputByGroupPlayerId:
    mocked.updateParticipantInputByGroupPlayerId,
}));
vi.mock("@server/repositories/table-event-repository.server", () => ({
  listOpenGameTableEvents: mocked.listOpenGameTableEvents,
}));
vi.mock("@server/repositories/group-paypay-repository.server", () => ({
  findGamePaymentAmountForPlayer: mocked.findGamePaymentAmountForPlayer,
}));
vi.mock("@server/repositories/game-cost-share-receipt-repository.server", () => ({
  listGameCostShareReceipts: mocked.listGameCostShareReceipts,
}));
vi.mock("@server/services/game-cost-share-receipt-service.server", () => ({
  updateGameCostShareReceipt: mocked.updateGameCostShareReceipt,
}));
vi.mock("@server/services/rebuy-service.server", () => ({
  recordOwnRebuyAction: mocked.recordOwnRebuyAction,
  undoOwnRebuyAction: mocked.undoOwnRebuyAction,
}));
vi.mock("@server/services/participant-session.server", () => ({
  clearParticipantCookie: vi.fn(() => "participant=; Max-Age=0"),
  createParticipantCookie: mocked.createParticipantCookie,
  readParticipantToken: vi.fn(() => null),
}));
vi.mock("@server/services/player-profile-service.server", () => ({
  createNewPlayerProfileSessionCredentials:
    mocked.createNewPlayerProfileSessionCredentials,
  getAuthenticatedPlayerIdentity: mocked.getAuthenticatedPlayerIdentity,
  getAuthenticatedPlayerProfile: mocked.getAuthenticatedPlayerProfile,
  selectPlayerProfile: mocked.selectPlayerProfile,
}));
vi.mock("@server/services/player-profile-session.server", () => ({
  createPlayerProfileCookie: mocked.createPlayerProfileCookie,
}));
vi.mock("@server/services/game-story-service.server", () => ({
  buildGameStoryPhotoUrl: vi.fn(() => null),
  deleteGameStoryPostAsOrganizer: mocked.deleteGameStoryPostAsOrganizer,
  getOwnGameStoryPost: mocked.getOwnGameStoryPost,
  getPublishedGameStoryPosts: mocked.getPublishedGameStoryPosts,
  saveFinalizedGameStory: mocked.saveFinalizedGameStory,
}));
vi.mock("@server/services/organizer-auth.server", () => ({
  isOrganizerAuthenticated: mocked.isOrganizerAuthenticated,
  requireOrganizer: mocked.requireOrganizer,
}));
vi.mock("@server/services/achievement-service.server", () => ({
  scheduleAchievementRefresh: vi.fn(),
}));
vi.mock("@domain/payment/paypay-link", () => ({
  isPayPayLinkActive: vi.fn(() => false),
}));
vi.mock("../components/final-results", () => ({
  FinalResults: vi.fn(() => null),
}));
vi.mock("../components/player-avatar", () => ({
  PlayerAvatar: vi.fn(() => null),
}));
vi.mock("../components/game-stories", () => ({
  GameStories: vi.fn(() => null),
}));
vi.mock("~/components/site-menu", () => ({
  GroupSiteHeader: vi.fn(() => null),
}));

import {
  action,
  loader,
  LocalRulesSheet,
  ParticipantResultEntrySection,
  ParticipantPlayerSnapshot,
  ParticipantRosterSheet,
  SettlementPlanSheet,
  projectRebuyState,
  resolveUndoableRebuyAction,
  shouldRevalidate,
  shouldShowLocalRules,
} from "./game-participant";

const group = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "River Check",
  payPayLinkRegisteredAt: null,
  payPayRecipientLink: null,
  publicCode: "river-check",
};
const gameId = "22222222-2222-4222-8222-222222222222";
const groupPlayerId = "33333333-3333-4333-8333-333333333333";
const playerId = "44444444-4444-4444-8444-444444444444";
const openGame = {
  id: gameId,
  initialChips: 20_000,
  playedAt: "2026-08-10T00:00:00.000Z",
  status: "open",
  title: "8月の会",
};
const profile = {
  avatarUploadedAt: null,
  displayName: "Alice",
  groupPlayerId,
  playerId,
};
const participant = {
  avatarUpdatedAt: null,
  deviceLocked: true,
  displayName: "Alice",
  groupPlayerId,
  id: "55555555-5555-4555-8555-555555555555",
  totalRebuyCount: 0,
  outstandingRebuyCount: 0,
  settlementRebuyCount: null,
  remainingChips: null,
  status: "joined",
};

describe("game participant route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocked.findGroupByPublicCode.mockResolvedValue(group);
    mocked.findGameForGroup.mockResolvedValue(openGame);
    mocked.findGameWithGroupByPublicCode.mockImplementation(
      async (publicCode: string, currentGameId: string) => {
        const currentGroup = await mocked.findGroupByPublicCode(publicCode);
        if (!currentGroup) return null;
        const currentGame = await mocked.findGameForGroup(
          currentGroup.id,
          currentGameId,
        );
        return currentGame ? { group: currentGroup, game: currentGame } : null;
      },
    );
    mocked.isOrganizerAuthenticated.mockResolvedValue(false);
    mocked.getAuthenticatedPlayerIdentity.mockResolvedValue(null);
    mocked.getAuthenticatedPlayerProfile.mockResolvedValue({
      group,
      profile,
    });
    mocked.joinExistingPlayerToGroupGame.mockResolvedValue(groupPlayerId);
    mocked.findParticipantByGroupPlayerId.mockResolvedValue(null);
    mocked.findParticipantByTokenHash.mockResolvedValue(null);
    mocked.getOpenGameTableEventCounts.mockResolvedValue({
      allInCount: 0,
      bombPotCount: 0,
      sevenDeuceCount: 0,
    });
    mocked.listCurrentGameParticipants.mockResolvedValue([]);
    mocked.listRegisteredPlayersForGame.mockResolvedValue([]);
    mocked.listFinalResults.mockResolvedValue([]);
    mocked.listGameCostShareReceipts.mockResolvedValue([]);
    mocked.listResultRevisions.mockResolvedValue([]);
    mocked.listOpenGameTableEvents.mockResolvedValue([]);
    mocked.listGamesForGroup.mockResolvedValue([]);
    mocked.getOwnGameStoryPost.mockResolvedValue(null);
    mocked.getPublishedGameStoryPosts.mockResolvedValue([]);
    mocked.updateParticipantInput.mockResolvedValue(true);
    mocked.updateParticipantInputByGroupPlayerId.mockResolvedValue(true);
    mocked.saveFinalizedGameStory.mockResolvedValue({ ok: true });
    mocked.deleteGameStoryPostAsOrganizer.mockResolvedValue(true);
    mocked.updateGameCostShareReceipt.mockResolvedValue({ ok: true });
    mocked.createParticipantCookie.mockReturnValue(
      "rc_participant_game=participant-token",
    );
    mocked.createPlayerProfileCookie.mockReturnValue(
      "rc_player_profile=profile-token",
    );
  });

  it("プロフィール認証済みでもloaderの反復実行では参加登録しない", async () => {
    const args = loaderArgs();

    const first = await loader(args);
    const second = await loader(args);

    expect(first.participant).toBeNull();
    expect(first.authenticatedPlayer).toEqual({
      avatarUrl: null,
      displayName: "Alice",
      groupPlayerId,
    });
    expect(second.participant).toBeNull();
    expect(mocked.joinAuthenticatedParticipant).not.toHaveBeenCalled();
    expect(mocked.findParticipantByGroupPlayerId).toHaveBeenCalledTimes(2);
  });

  it("内部の.dataリクエストを共有URLへ含めない", async () => {
    const result = await loader(
      loaderArgs(
        `https://example.com/g/river-check/games/${gameId}.data?notice=saved`,
      ),
    );

    expect(result.shareUrl).toBe(
      `https://example.com/r/${encodeResultCode(gameId)}`,
    );
  });

  it("open開催では現在の参加人数と一覧を本人表示付きで返す", async () => {
    const otherGroupPlayerId = "66666666-6666-4666-8666-666666666666";
    mocked.findParticipantByGroupPlayerId.mockResolvedValue(participant);
    mocked.listCurrentGameParticipants.mockResolvedValue([
      { displayName: "Alice", groupPlayerId, avatarUpdatedAt: null },
      {
        displayName: "Bob",
        groupPlayerId: otherGroupPlayerId,
        avatarUpdatedAt: null,
      },
    ]);

    const result = await loader(loaderArgs());

    expect(result.participantRoster).toEqual({
      available: true,
      items: [
        {
          groupPlayerId,
          displayName: "Alice",
          avatarUrl: null,
          isCurrentUser: true,
        },
        {
          groupPlayerId: otherGroupPlayerId,
          displayName: "Bob",
          avatarUrl: null,
          isCurrentUser: false,
        },
      ],
    });
    expect(mocked.listCurrentGameParticipants).toHaveBeenCalledWith(
      group.id,
      gameId,
    );
  });

  it("本人判定不能でも参加者一覧を返し、あなた表示だけを省略する", async () => {
    mocked.getAuthenticatedPlayerProfile.mockResolvedValue({
      group,
      profile: null,
    });
    mocked.listCurrentGameParticipants.mockResolvedValue([
      { displayName: "Alice", groupPlayerId, avatarUpdatedAt: null },
    ]);

    const result = await loader(loaderArgs());

    expect(result.participantRoster).toEqual({
      available: true,
      items: [
        {
          groupPlayerId,
          displayName: "Alice",
          avatarUrl: null,
          isCurrentUser: false,
        },
      ],
    });
  });

  it("別グループの本人プロフィールがある場合は共有リンクから参加候補として返す", async () => {
    mocked.getAuthenticatedPlayerProfile.mockResolvedValue({ group, profile: null });
    mocked.getAuthenticatedPlayerIdentity.mockResolvedValue({
      displayName: "Alice",
      playerId,
    });

    const result = await loader(loaderArgs());

    expect(result.groupInvitePlayer).toEqual({ displayName: "Alice" });
    expect(mocked.listRegisteredPlayersForGame).not.toHaveBeenCalled();
  });

  it("参加者一覧の取得失敗だけでは開催ページをエラーにしない", async () => {
    mocked.listCurrentGameParticipants.mockRejectedValue(
      new Error("temporary database error"),
    );

    const result = await loader(loaderArgs());

    expect(result.game.status).toBe("open");
    expect(result.participantRoster).toEqual({
      available: false,
      items: [],
    });
  });

  it("finalized開催では参加者一覧を取得せず入口用データも空にする", async () => {
    mocked.findGameForGroup.mockResolvedValue({
      ...openGame,
      bbRate: 5,
      costShares: [1_500],
      firstPlaceCost: 1_500,
      secondPlaceCost: 1_500,
      thirdPlaceCost: 1_500,
      status: "finalized",
      venueCost: 1_500,
    });

    const result = await loader(loaderArgs());

    expect(result.participantRoster).toEqual({
      available: true,
      items: [],
    });
    expect(mocked.listCurrentGameParticipants).not.toHaveBeenCalled();
  });

  it("finalized開催では公開対象のTABLE STORY投稿を開催詳細へ返す", async () => {
    mocked.findGameForGroup.mockResolvedValue({
      ...openGame,
      status: "finalized",
    });
    mocked.findGameWithGroupByPublicCode.mockResolvedValue({
      group,
      game: {
        ...openGame,
        status: "finalized",
      },
    });
    mocked.getPublishedGameStoryPosts.mockResolvedValue([
      {
        avatarUpdatedAt: null,
        body: "楽しい会でした！",
        createdAt: "2026-08-23T00:00:00.000Z",
        displayName: "Alice",
        groupPlayerId,
        id: "55555555-5555-4555-8555-555555555555",
        photo: null,
        updatedAt: "2026-08-23T00:00:00.000Z",
      },
    ]);

    const result = await loader(loaderArgs());

    expect(mocked.getPublishedGameStoryPosts).toHaveBeenCalledWith(
      group.id,
      gameId,
    );
    expect(result.storyPosts).toEqual([
      expect.objectContaining({
        body: "楽しい会でした！",
        displayName: "Alice",
        photoUrl: null,
      }),
    ]);
  });

  it("会費回収状況は確定済み開催を管理者として見る場合だけ返す", async () => {
    mocked.findGameForGroup.mockResolvedValue({
      ...openGame,
      status: "finalized",
    });
    mocked.isOrganizerAuthenticated.mockResolvedValue(true);
    mocked.listGameCostShareReceipts.mockResolvedValue([
      {
        costShare: 500,
        displayName: "Alice",
        groupPlayerId,
        receivedAt: null,
      },
    ]);

    const organizerResult = await loader(loaderArgs());
    expect(organizerResult.costShareReceipts).toHaveLength(1);
    expect(mocked.listGameCostShareReceipts).toHaveBeenCalledWith(
      group.id,
      gameId,
    );

    mocked.isOrganizerAuthenticated.mockResolvedValue(false);
    mocked.listGameCostShareReceipts.mockClear();
    const publicResult = await loader(loaderArgs());
    expect(publicResult.costShareReceipts).toEqual([]);
    expect(mocked.listGameCostShareReceipts).not.toHaveBeenCalled();
  });

  it("参加者入口と一覧には人数・全員の名前・本人表示だけを描画する", () => {
    const markup = renderToStaticMarkup(
      createElement(ParticipantRosterSheet, {
        available: true,
        items: [
          {
            groupPlayerId,
            displayName: "Alice",
            avatarUrl: null,
            isCurrentUser: true,
          },
          {
            groupPlayerId: "66666666-6666-4666-8666-666666666666",
            displayName: "Bob",
            avatarUrl: null,
            isCurrentUser: false,
          },
        ],
      }),
    );

    expect(markup).toContain("参加者 <strong>2</strong>");
    expect(markup).toContain("Alice");
    expect(markup).toContain("Bob");
    expect(markup).toContain("あなた");
    expect(markup).toContain('aria-haspopup="dialog"');
    expect(markup).toContain("参加者一覧を閉じる");
    expect(markup).not.toContain("リバイ回数");
    expect(markup).not.toContain("未返済");
    expect(markup).not.toContain("残りチップ");
  });

  it("他参加者には簡易戦績ボタンを表示し、本人の編集操作と役割を分ける", () => {
    const markup = renderToStaticMarkup(
      createElement(ParticipantRosterSheet, {
        available: true,
        items: [
          {
            groupPlayerId,
            displayName: "Alice",
            avatarUrl: null,
            isCurrentUser: true,
          },
          {
            groupPlayerId: "66666666-6666-4666-8666-666666666666",
            displayName: "Bob",
            avatarUrl: null,
            isCurrentUser: false,
          },
        ],
        quickStatsBasePath: `/g/river-check/games/${gameId}/players`,
        quickStatsFetcher: {
          state: "idle",
          data: undefined,
        } as never,
      }),
    );

    expect(markup).toContain("Bobの簡易戦績を見る");
    expect(markup).not.toContain("Aliceの簡易戦績を見る");
  });

  it("PLAYER SNAPSHOTはゲーム中に必要な5指標へ絞る", () => {
    const markup = renderToStaticMarkup(
      createElement(ParticipantPlayerSnapshot, {
        error: null,
        item: {
          groupPlayerId: "66666666-6666-4666-8666-666666666666",
          displayName: "Bob",
          avatarUrl: null,
          isCurrentUser: false,
          statusText: "今日は堅め",
        },
        loading: false,
        onRetry: () => undefined,
        stats: {
          ok: true,
          groupPlayerId: "66666666-6666-4666-8666-666666666666",
          displayName: "Bob",
          avatarUrl: null,
          gamesPlayed: 12,
          wins: 3,
          topThreeRate: 50,
          totalNetBb: 320,
          recentThreeNetBb: 85,
        },
      }),
    );

    expect(markup).toContain("PLAYER SNAPSHOT");
    expect(markup).toContain("+320BB");
    expect(markup).toContain("+85BB");
    expect(markup).toContain("12戦");
    expect(markup).toContain("3回");
    expect(markup).toContain("50%");
    expect(markup).not.toContain("最大勝ち");
    expect(markup).not.toContain("最大負け");
  });

  it("参加者0件では空状態を描画する", () => {
    const markup = renderToStaticMarkup(
      createElement(ParticipantRosterSheet, {
        available: true,
        items: [],
      }),
    );

    expect(markup).toContain("参加者はいません");
  });

  it("公開済みの精算予定を全順位分表示する", () => {
    const markup = renderToStaticMarkup(
      createElement(SettlementPlanSheet, {
        bbRate: 0,
        costShares: [1_000, 2_000],
        participantCount: 2,
        venueCost: 3_000,
      }),
    );

    expect(markup).toContain("今日の精算予定");
    expect(markup).toContain("1位");
    expect(markup).toContain("2位");
    expect(markup).toContain("1,000円");
    expect(markup).toContain("2,000円");
  });

  it("未入力の結果フォームは閉じておき、結果入力から開く", () => {
    const markup = renderToStaticMarkup(
      createElement(
        ParticipantResultEntrySection,
        null,
        createElement("span", null, "入力フォーム"),
      ),
    );

    expect(markup).toContain("結果を入力する");
    expect(markup).toContain(
      "残りチップと手元のリバイ証を保存します。主催者の確定前は修正できます。",
    );
    expect(markup).toContain("入力フォーム");
    expect(markup).toContain("<details");
    expect(markup).toContain("<summary");
    expect(markup).not.toContain('open=""');
  });

  it("修正中・保存失敗時のフォームは開いた状態で再表示する", () => {
    const markup = renderToStaticMarkup(
      createElement(ParticipantResultEntrySection, { initiallyOpen: true, children: "入力フォーム" }),
    );
    expect(markup).toContain('open=""');
    expect(markup).toContain("結果を入力中");
  });

  it("最終結果だけを保存し、TABLE STORYは更新しない", async () => {
    mocked.findParticipantByGroupPlayerId.mockResolvedValue(participant);

    const result = await action(
      actionArgs({
        intent: "save-input",
        remainingChips: "25000",
        settlementRebuyCount: "1",
        storyBody: "リバーのチョップが面白かった！",
      }),
    );

    expectRedirect(result);
    expect(mocked.updateParticipantInputByGroupPlayerId).toHaveBeenCalledWith(
      group.id,
      gameId,
      groupPlayerId,
      25_000,
      1,
    );
    expect(mocked.saveFinalizedGameStory).not.toHaveBeenCalled();
  });

  it("主催者は確定後も参加者投稿を削除できる", async () => {
    mocked.findGameForGroup.mockResolvedValue({
      ...openGame,
      status: "finalized",
    });
    const postId = "55555555-5555-4555-8555-555555555555";

    const result = await action(
      actionArgs({ intent: "delete-story-post", postId }),
    );

    const response = expectRedirect(result);
    expect(mocked.requireOrganizer).toHaveBeenCalledWith(
      expect.any(Request),
      "river-check",
    );
    expect(mocked.deleteGameStoryPostAsOrganizer).toHaveBeenCalledWith(
      group.id,
      gameId,
      postId,
    );
    expect(response.headers.get("Location")).toBe(
      `/g/river-check/games/${gameId}?notice=story-deleted`,
    );
  });

  it("参加者は確定済み開催へあとからTABLE STORYを投稿できる", async () => {
    mocked.findGameForGroup.mockResolvedValue({
      ...openGame,
      status: "finalized",
    });

    const result = await action(
      actionArgs({
        intent: "save-story-post",
        storyBody: "あとから思い出を追記",
      }),
    );

    const response = expectRedirect(result);
    expect(mocked.saveFinalizedGameStory).toHaveBeenCalledWith(
      group.id,
      gameId,
      expect.objectContaining({
        body: "あとから思い出を追記",
        photo: null,
        target: { kind: "group-player-id", value: groupPlayerId },
      }),
    );
    expect(response.headers.get("Location")).toBe(
      `/g/river-check/games/${gameId}?notice=story-saved`,
    );
  });

  it("参加者は確定済み開催の自分の投稿を削除できる", async () => {
    mocked.findGameForGroup.mockResolvedValue({
      ...openGame,
      status: "finalized",
    });

    const result = await action(
      actionArgs({
        intent: "save-story-post",
        removeStoryPhoto: "yes",
        storyBody: "",
      }),
    );

    const response = expectRedirect(result);
    expect(mocked.saveFinalizedGameStory).toHaveBeenCalledWith(
      group.id,
      gameId,
      expect.objectContaining({ body: "", removePhoto: true }),
    );
    expect(response.headers.get("Location")).toBe(
      `/g/river-check/games/${gameId}?notice=story-deleted`,
    );
  });

  it("開催共有リンクから既存プロフィールのまま新グループと開催へ参加できる", async () => {
    mocked.getAuthenticatedPlayerIdentity.mockResolvedValue({
      displayName: "Alice",
      playerId,
    });

    const result = await action(
      actionArgs({ intent: "join-current-profile-to-group" }),
    );

    const response = expectRedirect(result);
    expect(response.headers.get("Location")).toBe(
      "/g/river-check/games/" + gameId + "?notice=group-joined",
    );
    expect(mocked.joinExistingPlayerToGroupGame).toHaveBeenCalledWith(
      group.id,
      gameId,
      playerId,
      expect.stringMatching(/^[0-9a-f]{64}$/u),
    );
  });

  it("join-self actionで認証済みの本人が参加し303で戻る", async () => {
    mocked.joinAuthenticatedParticipant.mockResolvedValue(true);

    const result = await action(actionArgs({ intent: "join-self" }));

    const response = expectRedirect(result);
    expect(response.headers.get("Location")).toBe(
      `/g/river-check/games/${gameId}?notice=joined`,
    );
    expect(mocked.joinAuthenticatedParticipant).toHaveBeenCalledWith(
      group.id,
      gameId,
      groupPlayerId,
      expect.stringMatching(/^[0-9a-f]{64}$/u),
    );
  });

  it("未認証または無効なプロフィールではjoin-selfできない", async () => {
    mocked.getAuthenticatedPlayerProfile.mockResolvedValue({
      group,
      profile: null,
    });

    const result = await action(actionArgs({ intent: "join-self" }));

    expect(result).toEqual({
      error: "本人プロフィールを確認できません。再読み込みしてください。",
    });
    expect(mocked.joinAuthenticatedParticipant).not.toHaveBeenCalled();
  });

  it("受付終了後はjoin-selfできない", async () => {
    mocked.findGameForGroup.mockResolvedValue({
      ...openGame,
      status: "finalized",
    });

    const result = await action(actionArgs({ intent: "join-self" }));

    expect(result).toEqual({ error: "現在は参加を受け付けていません。" });
    expect(mocked.getAuthenticatedPlayerProfile).not.toHaveBeenCalled();
    expect(mocked.joinAuthenticatedParticipant).not.toHaveBeenCalled();
  });

  it("join-selfの二重送信は既存参加行を本人の成功として扱う", async () => {
    mocked.joinAuthenticatedParticipant
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    mocked.findParticipantByGroupPlayerId.mockResolvedValue(participant);

    const first = await action(actionArgs({ intent: "join-self" }));
    const second = await action(actionArgs({ intent: "join-self" }));

    expect(expectRedirect(first).status).toBe(303);
    expect(expectRedirect(second).status).toBe(303);
    expect(mocked.joinAuthenticatedParticipant).toHaveBeenCalledTimes(2);
    expect(mocked.findParticipantByGroupPlayerId).toHaveBeenCalledWith(
      group.id,
      gameId,
      groupPlayerId,
    );
  });

  it("リバイactionを本人用serviceへ渡す", async () => {
    mocked.recordOwnRebuyAction.mockResolvedValue({
      ok: true,
      eventId: "66666666-6666-4666-8666-666666666666",
      state: { totalRebuyCount: 1, outstandingRebuyCount: 1 },
    });

    const result = await action(
      actionArgs({
        intent: "record-rebuy",
        commandId: "77777777-7777-4777-8777-777777777777",
      }),
    );

    expect(result).toMatchObject({
      ok: true,
      commandId: "77777777-7777-4777-8777-777777777777",
      intent: "record-rebuy",
      state: { totalRebuyCount: 1, outstandingRebuyCount: 1 },
    });
    expect(mocked.recordOwnRebuyAction).toHaveBeenCalledWith(
      expect.any(Request),
      {
        actionType: "rebuy",
        commandId: "77777777-7777-4777-8777-777777777777",
        gameId,
        groupCode: "river-check",
        groupId: group.id,
      },
    );
  });

  it("未認証等のserviceエラーではリバイを記録できない", async () => {
    mocked.recordOwnRebuyAction.mockResolvedValue({
      ok: false,
      error: "参加者情報を確認できません。画面を更新してください。",
    });

    const result = await action(
      actionArgs({
        intent: "record-rebuy",
        commandId: "77777777-7777-4777-8777-777777777777",
      }),
    );

    expect(result).toMatchObject({
      ok: false,
      intent: "record-rebuy",
    });
  });

  it("登録済みメンバーを選ぶ既存参加導線を維持する", async () => {
    mocked.selectPlayerProfile.mockResolvedValue({
      ok: true,
      profile,
      sessionToken: "selected-profile-token",
    });
    mocked.joinAuthenticatedParticipant.mockResolvedValue(true);

    const result = await action(
      actionArgs({ intent: "join-existing", groupPlayerId }),
    );

    const response = expectRedirect(result);
    expect(response.headers.get("Location")).toContain("notice=joined");
    expect(mocked.selectPlayerProfile).toHaveBeenCalledWith(
      "river-check",
      groupPlayerId,
    );
    expect(response.headers.get("Set-Cookie")).toContain("rc_player_profile");
  });

  it("新しい名前で参加する既存導線とCookie発行を維持する", async () => {
    mocked.createNewPlayerProfileSessionCredentials.mockResolvedValue({
      expiresAt: "2027-08-10T00:00:00.000Z",
      token: "new-profile-token",
      tokenHash: "a".repeat(64),
    });
    mocked.joinNewParticipant.mockResolvedValue({
      groupPlayerId,
      playerId,
    });

    const result = await action(
      actionArgs({ intent: "join-new", displayName: "Bob" }),
    );

    const response = expectRedirect(result);
    expect(response.headers.get("Location")).toContain("notice=joined");
    expect(mocked.joinNewParticipant).toHaveBeenCalledWith(
      group.id,
      gameId,
      "Bob",
      expect.stringMatching(/^[0-9a-f]{64}$/u),
      "a".repeat(64),
      "2027-08-10T00:00:00.000Z",
    );
    expect(response.headers.get("Set-Cookie")).toContain(
      "rc_participant_game",
    );
    expect(response.headers.get("Set-Cookie")).toContain("rc_player_profile");
  });
});

describe("participant quick rebuy actions", () => {
  it("projects every rebuy, repayment and undo before the server replies", () => {
    const initial = { totalRebuyCount: 2, outstandingRebuyCount: 1 };
    const rebuy = projectRebuyState(initial, "record-rebuy");
    expect(rebuy).toEqual({ totalRebuyCount: 3, outstandingRebuyCount: 2 });
    expect(projectRebuyState(rebuy!, "undo-rebuy", "record-rebuy"))
      .toEqual(initial);
    const repayment = projectRebuyState(initial, "record-repayment");
    expect(repayment).toEqual({ totalRebuyCount: 2, outstandingRebuyCount: 0 });
    expect(projectRebuyState(repayment!, "undo-rebuy", "record-repayment"))
      .toEqual(initial);
    expect(projectRebuyState(repayment!, "record-repayment")).toBeNull();
    expect(initial).toEqual({ totalRebuyCount: 2, outstandingRebuyCount: 1 });
  });

  it("skips the full loader after successful rebuy writes, but refreshes on failure", () => {
    const options = (actionResult: unknown) => ({
      actionResult,
      currentUrl: new URL("https://example.com/g/river-check/games/game-1"),
      defaultShouldRevalidate: true,
      nextUrl: new URL("https://example.com/g/river-check/games/game-1"),
    }) as Parameters<typeof shouldRevalidate>[0];
    expect(shouldRevalidate(options({
      ok: true, intent: "record-rebuy",
    }))).toBe(false);
    expect(shouldRevalidate(options({
      ok: true, intent: "undo-rebuy",
    }))).toBe(false);
    expect(shouldRevalidate(options({
      ok: false, intent: "record-repayment",
    }))).toBe(true);
    expect(shouldRevalidate(options({ ok: true, intent: "save-input" })))
      .toBe(true);
  });
});

describe("resolveUndoableRebuyAction", () => {
  const first = {
    eventId: "66666666-6666-4666-8666-666666666666",
    intent: "record-rebuy" as const,
  };

  it("成功したリバイを時間制限なしの直前操作として保持する", () => {
    expect(
      resolveUndoableRebuyAction(null, {
        ok: true,
        eventId: first.eventId,
        intent: "record-rebuy",
        state: { totalRebuyCount: 1, outstandingRebuyCount: 1 },
      }),
    ).toEqual(first);
  });

  it("次の操作が失敗しても直前の成功操作をUNDO対象として残す", () => {
    expect(
      resolveUndoableRebuyAction(first, {
        ok: false,
        error: "未返済のリバイはありません。",
        intent: "record-repayment",
      }),
    ).toEqual(first);
  });

  it("次の成功操作でUNDO対象を置き換え、UNDO成功時に消す", () => {
    const repayment = resolveUndoableRebuyAction(first, {
      ok: true,
      eventId: "77777777-7777-4777-8777-777777777777",
      intent: "record-repayment",
      state: { totalRebuyCount: 1, outstandingRebuyCount: 0 },
    });
    expect(repayment).toEqual({
      eventId: "77777777-7777-4777-8777-777777777777",
      intent: "record-repayment",
    });
    expect(
      resolveUndoableRebuyAction(repayment, {
        ok: true,
        eventId: null,
        intent: "undo-rebuy",
        state: { totalRebuyCount: 1, outstandingRebuyCount: 1 },
      }),
    ).toBeNull();
  });
});

describe("LocalRulesSheet", () => {
  it("確定結果ではローカルルールを表示しない", () => {
    expect(shouldShowLocalRules("open")).toBe(true);
    expect(shouldShowLocalRules("finalized")).toBe(false);
  });

  it("適用中の72oルールと既存の100BB返済ルールを一緒に表示する", () => {
    const html = renderToStaticMarkup(
      createElement(LocalRulesSheet, {
        bigBlindAnteChips: 200,
        bigBlindChips: 200,
        bombPotRuleEnabled: true,
        initialChips: 20_000,
        smallBlindChips: 100,
        sevenDeuceRuleEnabled: true,
      }),
    );

    expect(html).toContain("ローカルルールを確認");
    expect(html).toContain("100BB返済ルール");
    expect(html).toContain("72oボーナス");
    expect(html).toContain("ほかの参加者全員から2.5BBずつ受け取ります");
    expect(html).toContain("ボムポット");
    expect(html).toContain("プリフロップ");
    expect(html).toContain("適用中");
    expect(html).toContain("STARTING STACK");
    expect(html).toContain("<small>SB</small><strong>100</strong>");
    expect(html).toContain("<small>BB</small><strong>200</strong>");
    expect(html).toContain("<small>BBA</small><strong>200</strong>");
  });

  it("保存済みの実卓ブラインドと25BB開始を確認できる", () => {
    const html = renderToStaticMarkup(
      createElement(LocalRulesSheet, {
        bigBlindAnteChips: 20,
        bigBlindChips: 20,
        bombPotRuleEnabled: true,
        initialChips: 500,
        initialStackBb: 25,
        smallBlindChips: 10,
        sevenDeuceRuleEnabled: true,
      }),
    );

    expect(html).toContain("<small>SB</small><strong>10</strong>");
    expect(html).toContain("<small>BB</small><strong>20</strong>");
    expect(html).toContain("<small>BBA</small><strong>20</strong>");
    expect(html).toContain("初期 500チップ ・ 1BB = 20チップ");
  });

  it("開催設定が無効なら72oルールをOFFと表示する", () => {
    const html = renderToStaticMarkup(
      createElement(LocalRulesSheet, {
        bigBlindAnteChips: 200,
        bigBlindChips: 200,
        bombPotRuleEnabled: false,
        initialChips: 20_000,
        smallBlindChips: 100,
        sevenDeuceRuleEnabled: false,
      }),
    );

    expect(html).toContain("この開催では適用しません。");
    expect(html).toContain("OFF");
  });
});

function loaderArgs(
  requestUrl = `https://example.com/g/river-check/games/${gameId}`,
) {
  return {
    params: { gameId, groupCode: "river-check" },
    request: new Request(requestUrl),
  } as Parameters<typeof loader>[0];
}

function actionArgs(values: Record<string, string>) {
  return {
    params: { gameId, groupCode: "river-check" },
    request: new Request(
      `https://example.com/g/river-check/games/${gameId}`,
      {
        body: new URLSearchParams(values),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        method: "POST",
      },
    ),
  } as Parameters<typeof action>[0];
}

function expectRedirect(result: Awaited<ReturnType<typeof action>>): Response {
  expect(result).toBeInstanceOf(Response);
  const response = result as Response;
  expect(response.status).toBe(303);
  return response;
}

describe("finalized game invite-only access", () => {
  it("未所属ゲストでもURLを知っていれば確定結果だけ閲覧できる", async () => {
    vi.resetAllMocks();
    mocked.findGroupByPublicCode.mockResolvedValue(group);
    mocked.findGameForGroup.mockResolvedValue({
      ...openGame,
      status: "finalized",
    });
    mocked.findGameWithGroupByPublicCode.mockResolvedValue({
      group,
      game: {
        ...openGame,
        status: "finalized",
      },
    });
    mocked.isOrganizerAuthenticated.mockResolvedValue(false);
    mocked.getAuthenticatedPlayerProfile.mockResolvedValue({
      group,
      profile: null,
    });
    mocked.findParticipantByTokenHash.mockResolvedValue(null);
    mocked.listFinalResults.mockResolvedValue([
      {
        avatarUpdatedAt: null,
        costShare: 1500,
        gameSettlementAmount: 1_500,
        displayName: "Alice",
        groupPlayerId,
        rank: 1,
        remainingChips: 25000,
        score: 5000,
        settlementRebuyCount: 0,
        totalRebuyCount: 0,
        trackedOutstandingRebuyCount: 0,
      },
    ]);
    mocked.listResultRevisions.mockResolvedValue([
      {
        id: "revision-1",
        revisionNumber: 1,
        correctedAt: "2026-08-11T00:00:00.000Z",
        beforeResults: [
          {
            costShare: 2000,
            gameSettlementAmount: 1_000,
            displayName: "Alice",
            groupPlayerId,
            rank: 1,
            remainingChips: 25000,
            score: 5000,
            settlementRebuyCount: 0,
            totalRebuyCount: 0,
            trackedOutstandingRebuyCount: 0,
          },
        ],
        afterResults: [
          {
            costShare: 1500,
            gameSettlementAmount: 1_500,
            displayName: "Alice",
            groupPlayerId,
            rank: 1,
            remainingChips: 25000,
            score: 5000,
            settlementRebuyCount: 0,
            totalRebuyCount: 0,
            trackedOutstandingRebuyCount: 0,
          },
        ],
      },
    ]);

    const result = await loader(loaderArgs());

    expect(result.isPublicResultViewer).toBe(true);
    expect(result.canBrowseGroup).toBe(false);
    expect(result.pastGameNavigation).toBeNull();
    expect(result.payPay).toBeNull();
    expect(result.lineText).toBe("");
    expect(result.results[0]?.costShare).toBe(0);
    expect(result.results[0]?.gameSettlementAmount).toBe(0);
    expect(result.game.bbRate).toBe(0);
    expect(result.game.venueCost).toBe(0);
    expect(result.game.costShares).toBeNull();
    expect(result.revisions[0]?.beforeResults[0]?.costShare).toBe(0);
    expect(result.revisions[0]?.beforeResults[0]?.gameSettlementAmount).toBe(0);
    expect(result.revisions[0]?.afterResults[0]?.costShare).toBe(0);
    expect(result.revisions[0]?.afterResults[0]?.gameSettlementAmount).toBe(0);
    expect(result.storyPosts).toEqual([]);
    expect(mocked.listGamesForGroup).not.toHaveBeenCalled();
    expect(mocked.getPublishedGameStoryPosts).not.toHaveBeenCalled();
  });

  it("未所属ゲストはdraft開催を閲覧できない", async () => {
    vi.resetAllMocks();
    mocked.findGroupByPublicCode.mockResolvedValue(group);
    mocked.findGameForGroup.mockResolvedValue({
      ...openGame,
      status: "draft",
    });
    mocked.findGameWithGroupByPublicCode.mockResolvedValue({
      group,
      game: {
        ...openGame,
        status: "draft",
      },
    });
    mocked.isOrganizerAuthenticated.mockResolvedValue(false);
    mocked.getAuthenticatedPlayerProfile.mockResolvedValue({
      group,
      profile: null,
    });
    mocked.findParticipantByTokenHash.mockResolvedValue(null);

    await expect(loader(loaderArgs())).rejects.toMatchObject({ status: 403 });
  });
});
