import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  createNewPlayerProfileSessionCredentials: vi.fn(),
  createParticipantCookie: vi.fn(),
  createPlayerProfileCookie: vi.fn(),
  findGameForGroup: vi.fn(),
  findGamePaymentAmountForPlayer: vi.fn(),
  findGroupByPublicCode: vi.fn(),
  findParticipantByGroupPlayerId: vi.fn(),
  getAuthenticatedPlayerProfile: vi.fn(),
  getGameHighlight: vi.fn(),
  isOrganizerAuthenticated: vi.fn(),
  joinAuthenticatedParticipant: vi.fn(),
  joinNewParticipant: vi.fn(),
  leaveGame: vi.fn(),
  leaveGameByGroupPlayerId: vi.fn(),
  listFinalResults: vi.fn(),
  listGamesForGroup: vi.fn(),
  listRegisteredPlayersForGame: vi.fn(),
  listResultRevisions: vi.fn(),
  selectPlayerProfile: vi.fn(),
  updateParticipantInput: vi.fn(),
  updateParticipantInputByGroupPlayerId: vi.fn(),
  recordOwnRebuyAction: vi.fn(),
  undoOwnRebuyAction: vi.fn(),
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
  joinAuthenticatedParticipant: mocked.joinAuthenticatedParticipant,
  joinNewParticipant: mocked.joinNewParticipant,
  leaveGame: mocked.leaveGame,
  leaveGameByGroupPlayerId: mocked.leaveGameByGroupPlayerId,
  listRegisteredPlayersForGame: mocked.listRegisteredPlayersForGame,
  updateParticipantInput: mocked.updateParticipantInput,
  updateParticipantInputByGroupPlayerId:
    mocked.updateParticipantInputByGroupPlayerId,
}));
vi.mock("@server/repositories/group-paypay-repository.server", () => ({
  findGamePaymentAmountForPlayer: mocked.findGamePaymentAmountForPlayer,
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
vi.mock("@server/services/game-highlight-service.server", () => ({
  buildGamePhotoUrl: vi.fn(() => null),
  getGameHighlight: mocked.getGameHighlight,
}));
vi.mock("@server/services/organizer-auth.server", () => ({
  isOrganizerAuthenticated: mocked.isOrganizerAuthenticated,
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
vi.mock("../components/game-highlight", () => ({
  GameHighlight: vi.fn(() => null),
}));
vi.mock("~/components/site-menu", () => ({
  GroupSiteHeader: vi.fn(() => null),
}));

import { action, loader } from "./game-participant";

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
    mocked.listRegisteredPlayersForGame.mockResolvedValue([]);
    mocked.listFinalResults.mockResolvedValue([]);
    mocked.listResultRevisions.mockResolvedValue([]);
    mocked.listGamesForGroup.mockResolvedValue([]);
    mocked.getGameHighlight.mockResolvedValue(null);
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
      `https://example.com/g/river-check/games/${gameId}`,
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
