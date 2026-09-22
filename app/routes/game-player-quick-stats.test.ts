import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  findGameWithGroupByPublicCode: vi.fn(),
  findParticipantByGroupPlayerId: vi.fn(),
  findParticipantByTokenHash: vi.fn(),
  getAuthenticatedPlayerProfile: vi.fn(),
  getPlayerQuickStats: vi.fn(),
  hashToken: vi.fn(),
  isOrganizerAuthenticated: vi.fn(),
  readParticipantToken: vi.fn(),
}));

vi.mock("@server/repositories/game-repository.server", () => ({
  findGameWithGroupByPublicCode: mocked.findGameWithGroupByPublicCode,
}));
vi.mock("@server/repositories/participant-repository.server", () => ({
  findParticipantByGroupPlayerId: mocked.findParticipantByGroupPlayerId,
  findParticipantByTokenHash: mocked.findParticipantByTokenHash,
}));
vi.mock("@server/services/organizer-auth.server", () => ({
  isOrganizerAuthenticated: mocked.isOrganizerAuthenticated,
}));
vi.mock("@server/services/participant-session.server", () => ({
  readParticipantToken: mocked.readParticipantToken,
}));
vi.mock("@server/services/player-profile-service.server", () => ({
  getAuthenticatedPlayerProfile: mocked.getAuthenticatedPlayerProfile,
}));
vi.mock("@server/services/player-stats-service.server", () => ({
  getPlayerQuickStats: mocked.getPlayerQuickStats,
}));
vi.mock("@server/services/token.server", () => ({
  hashToken: mocked.hashToken,
}));

import { loader } from "./game-player-quick-stats";

const groupId = "11111111-1111-4111-8111-111111111111";
const gameId = "22222222-2222-4222-8222-222222222222";
const viewerId = "33333333-3333-4333-8333-333333333333";
const targetId = "44444444-4444-4444-8444-444444444444";
const group = {
  id: groupId,
  name: "River Check",
  publicCode: "river-check",
};
const game = {
  id: gameId,
  status: "open",
};

describe("game player quick stats", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocked.findGameWithGroupByPublicCode.mockResolvedValue({ group, game });
    mocked.isOrganizerAuthenticated.mockResolvedValue(false);
    mocked.getAuthenticatedPlayerProfile.mockResolvedValue({
      group,
      profile: { groupPlayerId: viewerId },
    });
    mocked.findParticipantByGroupPlayerId.mockResolvedValue({
      groupPlayerId: targetId,
      displayName: "Bob",
      avatarUpdatedAt: null,
    });
    mocked.getPlayerQuickStats.mockResolvedValue({
      gamesPlayed: 12,
      wins: 3,
      topThreeRate: 50,
      totalNetBb: 320,
      recentThreeNetBb: 85,
    });
  });

  it("開催中の他参加者について確定済み戦績だけを返す", async () => {
    const response = await loader(loaderArgs());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(data).toEqual({
      ok: true,
      groupPlayerId: targetId,
      displayName: "Bob",
      avatarUrl: null,
      gamesPlayed: 12,
      wins: 3,
      topThreeRate: 50,
      totalNetBb: 320,
      recentThreeNetBb: 85,
    });
    expect(mocked.getPlayerQuickStats).toHaveBeenCalledWith(groupId, targetId);
  });

  it("グループ未所属でも同じ開催の参加者Cookieがあれば閲覧できる", async () => {
    mocked.getAuthenticatedPlayerProfile.mockResolvedValue(null);
    mocked.readParticipantToken.mockReturnValue("participant-token");
    mocked.hashToken.mockResolvedValue("hashed-token");
    mocked.findParticipantByTokenHash.mockResolvedValue({
      groupPlayerId: viewerId,
    });

    const response = await loader(loaderArgs());

    expect(response.status).toBe(200);
    expect(mocked.findParticipantByTokenHash).toHaveBeenCalledWith(
      groupId,
      gameId,
      "hashed-token",
    );
  });

  it("未所属かつ未参加の閲覧者には戦績を返さない", async () => {
    mocked.getAuthenticatedPlayerProfile.mockResolvedValue(null);
    mocked.readParticipantToken.mockReturnValue(null);

    const response = await loader(loaderArgs());
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data).toEqual({
      ok: false,
      error: "参加者だけが簡易戦績を確認できます。",
    });
    expect(mocked.getPlayerQuickStats).not.toHaveBeenCalled();
  });

  it("URLのplayerIdが現在の参加者でなければ戦績を返さない", async () => {
    mocked.findParticipantByGroupPlayerId.mockResolvedValue(null);

    const response = await loader(loaderArgs());

    expect(response.status).toBe(404);
    expect(mocked.getPlayerQuickStats).not.toHaveBeenCalled();
  });
});

function loaderArgs() {
  return {
    request: new Request(
      `https://example.com/g/river-check/games/${gameId}/players/${targetId}/quick-stats`,
    ),
    params: {
      groupCode: "river-check",
      gameId,
      groupPlayerId: targetId,
    },
    context: {},
  } as never;
}
