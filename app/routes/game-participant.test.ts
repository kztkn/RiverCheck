import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { encodeResultCode } from "@domain/result-sharing/result-code";

const mocked = vi.hoisted(() => ({
  createNewPlayerProfileSessionCredentials: vi.fn(),
  createParticipantCookie: vi.fn(),
  createPlayerProfileCookie: vi.fn(),
  findGameForGroup: vi.fn(),
  findGamePaymentAmountForPlayer: vi.fn(),
  findGroupByPublicCode: vi.fn(),
  findParticipantByGroupPlayerId: vi.fn(),
  findParticipantByTokenHash: vi.fn(),
  getAuthenticatedPlayerProfile: vi.fn(),
  getOwnGameStoryPost: vi.fn(),
  getPublishedGameStoryPosts: vi.fn(),
  isOrganizerAuthenticated: vi.fn(),
  joinAuthenticatedParticipant: vi.fn(),
  joinNewParticipant: vi.fn(),
  leaveGame: vi.fn(),
  leaveGameByGroupPlayerId: vi.fn(),
  listFinalResults: vi.fn(),
  listGameCostShareReceipts: vi.fn(),
  listGamesForGroup: vi.fn(),
  listCurrentGameParticipants: vi.fn(),
  listRegisteredPlayersForGame: vi.fn(),
  listResultRevisions: vi.fn(),
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
  joinAuthenticatedParticipant: mocked.joinAuthenticatedParticipant,
  joinNewParticipant: mocked.joinNewParticipant,
  leaveGame: mocked.leaveGame,
  leaveGameByGroupPlayerId: mocked.leaveGameByGroupPlayerId,
  listCurrentGameParticipants: mocked.listCurrentGameParticipants,
  listRegisteredPlayersForGame: mocked.listRegisteredPlayersForGame,
  updateParticipantInput: mocked.updateParticipantInput,
  updateParticipantInputByGroupPlayerId:
    mocked.updateParticipantInputByGroupPlayerId,
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
  ParticipantRosterSheet,
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
    mocked.isOrganizerAuthenticated.mockResolvedValue(false);
    mocked.getAuthenticatedPlayerProfile.mockResolvedValue({
      group,
      profile,
    });
    mocked.findParticipantByGroupPlayerId.mockResolvedValue(null);
    mocked.findParticipantByTokenHash.mockResolvedValue(null);
    mocked.listCurrentGameParticipants.mockResolvedValue([]);
    mocked.listRegisteredPlayersForGame.mockResolvedValue([]);
    mocked.listFinalResults.mockResolvedValue([]);
    mocked.listGameCostShareReceipts.mockResolvedValue([]);
    mocked.listResultRevisions.mockResolvedValue([]);
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
      { displayName: "Alice", groupPlayerId },
      { displayName: "Bob", groupPlayerId: otherGroupPlayerId },
    ]);

    const result = await loader(loaderArgs());

    expect(result.participantRoster).toEqual({
      available: true,
      items: [
        { displayName: "Alice", isCurrentUser: true },
        { displayName: "Bob", isCurrentUser: false },
      ],
    });
    expect(mocked.listCurrentGameParticipants).toHaveBeenCalledWith(
      group.id,
      gameId,
    );
  });

  it("参加取り消し済み行を含まないrepository結果だけを一覧へ返す", async () => {
    mocked.listCurrentGameParticipants.mockResolvedValue([
      { displayName: "Alice", groupPlayerId },
    ]);

    const result = await loader(loaderArgs());

    expect(result.participantRoster.items.map((item) => item.displayName)).toEqual([
      "Alice",
    ]);
    expect(result.participantRoster.items).not.toContainEqual(
      expect.objectContaining({ displayName: "Canceled player" }),
    );
  });

  it("本人判定不能でも参加者一覧を返し、あなた表示だけを省略する", async () => {
    mocked.getAuthenticatedPlayerProfile.mockResolvedValue({
      group,
      profile: null,
    });
    mocked.listCurrentGameParticipants.mockResolvedValue([
      { displayName: "Alice", groupPlayerId },
    ]);

    const result = await loader(loaderArgs());

    expect(result.participantRoster).toEqual({
      available: true,
      items: [{ displayName: "Alice", isCurrentUser: false }],
    });
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
      status: "finalized",
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
          { displayName: "Alice", isCurrentUser: true },
          { displayName: "Bob", isCurrentUser: false },
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

  it("参加者0件では空状態を描画する", () => {
    const markup = renderToStaticMarkup(
      createElement(ParticipantRosterSheet, {
        available: true,
        items: [],
      }),
    );

    expect(markup).toContain("参加者はいません");
  });

  it("未入力の最終結果フォームを折りたたまず表示する", () => {
    const markup = renderToStaticMarkup(
      createElement(
        ParticipantResultEntrySection,
        null,
        createElement("span", null, "入力フォーム"),
      ),
    );

    expect(markup).toContain("最終結果を入力");
    expect(markup).toContain(
      "ゲームが終了したら、残りチップと手元のリバイ証を入力します。",
    );
    expect(markup).toContain("入力フォーム");
    expect(markup).not.toContain("<details");
    expect(markup).not.toContain("<summary");
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

  it("主催者だけが会費を受取済みに更新できる", async () => {
    mocked.findGameForGroup.mockResolvedValue({
      ...openGame,
      status: "finalized",
    });

    const result = await action(
      actionArgs({
        intent: "update-cost-share-receipt",
        groupPlayerId,
        received: "yes",
      }),
    );

    expect(mocked.requireOrganizer).toHaveBeenCalledWith(
      expect.any(Request),
      "river-check",
    );
    expect(mocked.updateGameCostShareReceipt).toHaveBeenCalledWith(
      group.id,
      gameId,
      groupPlayerId,
      true,
    );
    expect(result).toEqual({
      ok: true,
      intent: "update-cost-share-receipt",
      groupPlayerId,
      received: true,
    });
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

describe("LocalRulesSheet", () => {
  it("確定結果ではローカルルールを表示しない", () => {
    expect(shouldShowLocalRules("open")).toBe(true);
    expect(shouldShowLocalRules("finalized")).toBe(false);
  });

  it("適用中の72oルールと既存の100BB返済ルールを一緒に表示する", () => {
    const html = renderToStaticMarkup(
      createElement(LocalRulesSheet, {
        bombPotRuleEnabled: true,
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
  });

  it("開催設定が無効なら72oルールをOFFと表示する", () => {
    const html = renderToStaticMarkup(
      createElement(LocalRulesSheet, {
        bombPotRuleEnabled: false,
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
