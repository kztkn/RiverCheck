import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  clearParticipantCookie: vi.fn(() => "participant=; Max-Age=0"),
  findGameForGroup: vi.fn(),
  findGroupByPublicCode: vi.fn(),
  removeOpenGameForGroup: vi.fn(),
  updateOpenGameIdentityForGroup: vi.fn(),
  requireOrganizer: vi.fn(),
}));

vi.mock("@server/repositories/game-repository.server", () => ({
  findGameForGroup: mocked.findGameForGroup,
  updateLocalRules: vi.fn(),
}));
vi.mock("@server/repositories/group-repository.server", () => ({
  findGroupByPublicCode: mocked.findGroupByPublicCode,
}));
vi.mock("@server/repositories/participant-repository.server", () => ({
  findParticipantByTokenHash: vi.fn(),
  listGameParticipants: vi.fn(),
  removeParticipant: vi.fn(),
  updateParticipantInputByGroupPlayerId: vi.fn(),
}));
vi.mock("@server/services/participant-session.server", () => ({
  clearParticipantCookie: mocked.clearParticipantCookie,
  readParticipantToken: vi.fn(() => null),
}));
vi.mock("@server/services/token.server", () => ({
  hashToken: vi.fn(),
}));
vi.mock("@server/services/organizer-auth.server", () => ({
  requireOrganizer: mocked.requireOrganizer,
}));
vi.mock("@server/services/rebuy-service.server", () => ({
  adjustOrganizerRebuyState: vi.fn(),
  recordOrganizerRebuyAction: vi.fn(),
  undoOrganizerRebuyAction: vi.fn(),
}));
vi.mock("@server/services/game-service.server", () => ({
  removeOpenGameForGroup: mocked.removeOpenGameForGroup,
  updateOpenGameIdentityForGroup: mocked.updateOpenGameIdentityForGroup,
  validateGameSettingsForm: vi.fn(),
}));
vi.mock("@server/services/finalization-service.server", () => ({
  buildFinalizationState: vi.fn(),
  finalizeGame: vi.fn(),
}));
vi.mock("~/components/site-menu", () => ({
  GroupSiteHeader: vi.fn(() => null),
}));

import { action } from "./game-admin";

const group = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "River Check",
  publicCode: "river-check",
};
const game = {
  id: "22222222-2222-4222-8222-222222222222",
  status: "open",
  title: "8月の会",
};

describe("game admin management action", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocked.findGroupByPublicCode.mockResolvedValue(group);
    mocked.findGameForGroup.mockResolvedValue(game);
  });

  it("開催設定の保存1回で開催名と開催日をまとめて更新する", async () => {
    mocked.updateOpenGameIdentityForGroup.mockResolvedValue({ ok: true });

    const result = await action(
      actionArgs({
        intent: "update-game-identity",
        title: "9月の会",
        playedAt: "2026-09-11",
      }),
    );

    expect(mocked.requireOrganizer).toHaveBeenCalledWith(
      expect.any(Request),
      "river-check",
    );
    expect(mocked.updateOpenGameIdentityForGroup).toHaveBeenCalledWith(
      group.id,
      game.id,
      { title: "9月の会", playedAt: "2026-09-11" },
    );
    expect(result).toBeInstanceOf(Response);
    const response = result as Response;
    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe(
      `/g/river-check/games/${game.id}/admin?notice=game-settings-updated`,
    );
  });

  it("開催を削除して主催者ホームへ戻り参加者Cookieも消す", async () => {
    mocked.removeOpenGameForGroup.mockResolvedValue({ ok: true });

    const result = await action(actionArgs({ intent: "delete-game" }));

    expect(mocked.removeOpenGameForGroup).toHaveBeenCalledWith(
      group.id,
      game.id,
    );
    expect(result).toBeInstanceOf(Response);
    const response = result as Response;
    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe(
      `/g/river-check/manage?notice=game-deleted&deletedGameId=${game.id}`,
    );
    expect(response.headers.get("Set-Cookie")).toContain("Max-Age=0");
  });

  it("受付中でなくなった開催は削除結果を成功扱いしない", async () => {
    mocked.removeOpenGameForGroup.mockResolvedValue({
      ok: false,
      error: "確定済みの開催は削除できません。",
    });

    await expect(
      action(actionArgs({ intent: "delete-game" })),
    ).resolves.toEqual({
      ok: false,
      error: "確定済みの開催は削除できません。",
      intent: "delete-game",
    });
  });
});

function actionArgs(values: Record<string, string>) {
  return {
    params: { gameId: game.id, groupCode: "river-check" },
    request: new Request(
      `https://example.com/g/river-check/games/${game.id}/admin`,
      {
        body: new URLSearchParams(values),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        method: "POST",
      },
    ),
  } as Parameters<typeof action>[0];
}
