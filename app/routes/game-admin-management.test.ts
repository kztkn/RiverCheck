import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  clearParticipantCookie: vi.fn(() => "participant=; Max-Age=0"),
  findGameForGroup: vi.fn(),
  findGroupByPublicCode: vi.fn(),
  removeOpenGameForGroup: vi.fn(),
  renameOpenGameForGroup: vi.fn(),
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
  renameOpenGameForGroup: mocked.renameOpenGameForGroup,
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

  it("主催者認証後に開催名を変更して管理画面へ戻る", async () => {
    mocked.renameOpenGameForGroup.mockResolvedValue({ ok: true });

    const result = await action(
      actionArgs({ intent: "rename-game", title: "9月の会" }),
    );

    expect(mocked.requireOrganizer).toHaveBeenCalledWith(
      expect.any(Request),
      "river-check",
    );
    expect(mocked.renameOpenGameForGroup).toHaveBeenCalledWith(
      group.id,
      game.id,
      "9月の会",
    );
    expect(result).toBeInstanceOf(Response);
    const response = result as Response;
    expect(response.status).toBe(303);
    expect(response.headers.get("Location")).toBe(
      `/g/river-check/games/${game.id}/admin?notice=game-renamed`,
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
      "/g/river-check/manage?notice=game-deleted",
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
