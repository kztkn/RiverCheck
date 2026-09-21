import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  clearParticipantCookie: vi.fn(() => "participant=; Max-Age=0"),
  findGameForGroup: vi.fn(),
  findGameWithGroupByPublicCode: vi.fn(),
  findGroupByPublicCode: vi.fn(),
  publishSettlementPlan: vi.fn(),
  removeOpenGameForGroup: vi.fn(),
  updateLocalRules: vi.fn(),
  updateOpenGameIdentityForGroup: vi.fn(),
  validateGameSettingsForm: vi.fn(),
  requireOrganizer: vi.fn(),
}));

vi.mock("@server/repositories/game-repository.server", () => ({
  findGameForGroup: mocked.findGameForGroup,
  findGameWithGroupByPublicCode: mocked.findGameWithGroupByPublicCode,
  publishSettlementPlan: mocked.publishSettlementPlan,
  updateLocalRules: mocked.updateLocalRules,
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
  validateGameSettingsForm: mocked.validateGameSettingsForm,
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
  bombPotRuleEnabled: false,
  costShares: [1_000, 2_000],
  firstPlaceCost: 1_000,
  id: "22222222-2222-4222-8222-222222222222",
  initialChips: 20_000,
  playedAt: "2026-08-10T00:00:00.000Z",
  previewParticipantCount: 2,
  secondPlaceCost: 2_000,
  sevenDeuceRuleEnabled: false,
  status: "open",
  thirdPlaceCost: 2_000,
  title: "8月の会",
  venueCost: 3_000,
};

describe("game admin management action", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocked.findGroupByPublicCode.mockResolvedValue(group);
    mocked.findGameForGroup.mockResolvedValue(game);
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
  });

  it("検証済みの精算予定を公開して管理画面へ戻す", async () => {
    const input = {
      venueCost: 3_000,
      firstPlaceCost: 1_000,
      secondPlaceCost: 2_000,
      thirdPlaceCost: 2_000,
      previewParticipantCount: 2,
      costShares: [1_000, 2_000],
    };
    mocked.validateGameSettingsForm.mockReturnValue({ ok: true, input });
    mocked.publishSettlementPlan.mockResolvedValue(true);

    const result = await action(
      actionArgs({
        intent: "publish-settlement-plan",
        venueCost: "3000",
        firstPlaceCost: "1000",
        secondPlaceCost: "2000",
        thirdPlaceCost: "2000",
        previewParticipantCount: "2",
        costShare: "1000",
      }),
    );

    expect(mocked.publishSettlementPlan).toHaveBeenCalledWith(
      group.id,
      game.id,
      input,
    );
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).headers.get("Location")).toBe(
      `/g/river-check/games/${game.id}/admin?notice=settlement-plan-published`,
    );
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

  it("ローカルルール保存は画面遷移せず成功データを返す", async () => {
    mocked.updateLocalRules.mockResolvedValue(true);

    const result = await action(
      actionArgs({
        intent: "save-local-rules",
        sevenDeuceRuleEnabled: "yes",
      }),
    );

    expect(mocked.updateLocalRules).toHaveBeenCalledWith(
      group.id,
      game.id,
      {
        sevenDeuceRuleEnabled: true,
        bombPotRuleEnabled: false,
      },
    );
    expect(result).toEqual({
      ok: true,
      intent: "save-local-rules",
    });
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
