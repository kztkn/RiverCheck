import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  events: [] as string[],
  insertFinalResults: vi.fn(),
  lockGame: vi.fn(),
  lockParticipants: vi.fn(),
  markFinalized: vi.fn(),
  notifyGameFinalized: vi.fn(),
  saveCostSettings: vi.fn(),
}));

vi.mock("@server/db/client.server", () => ({
  withTransaction: vi.fn(async (callback: (transaction: object) => Promise<unknown>) => {
    const result = await callback({});
    mocked.events.push("committed");
    return result;
  }),
}));
vi.mock("@server/repositories/finalization-repository.server", () => ({
  insertFinalResults: mocked.insertFinalResults,
  insertResultRevision: vi.fn(),
  lockFinalResults: vi.fn(),
  lockGameForFinalization: mocked.lockGame,
  lockParticipantsForFinalization: mocked.lockParticipants,
  markGameFinalized: mocked.markFinalized,
  replaceFinalResults: vi.fn(),
  saveCostSettingsForFinalization: mocked.saveCostSettings,
  toFinalizationParticipants: (rows: unknown[]) => rows,
  updateFinalizedGameIdentity: vi.fn(),
  updateParticipantsForCorrection: vi.fn(),
}));
vi.mock("@server/services/achievement-service.server", () => ({
  awardAchievementsForPlayers: vi.fn(),
}));
vi.mock("@server/services/push-notification-service.server", () => ({
  notifyGameFinalized: mocked.notifyGameFinalized,
}));

import { finalizeGame } from "@server/services/finalization-service.server";

const group = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "RiverCheck",
  publicCode: "river-check",
};
const gameId = "22222222-2222-4222-8222-222222222222";
const settings = {
  title: "8月のポーカー会",
  playedAt: "2026-08-30T00:00:00.000Z",
  initialChips: 20_000,
  rebuyChips: 10_000,
  previewParticipantCount: 4,
  venueCost: 10_000,
  firstPlaceCost: 0,
  secondPlaceCost: 500,
  thirdPlaceCost: 1_000,
  costShares: [0, 500, 1_000, 8_500],
  sevenDeuceRuleEnabled: true,
  bombPotRuleEnabled: true,
};

describe("game finalization notification", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocked.events.length = 0;
    mocked.lockGame.mockResolvedValue({
      id: gameId,
      groupId: group.id,
      title: settings.title,
      playedAt: settings.playedAt,
      status: "open",
      initialChips: settings.initialChips,
      rebuyChips: settings.rebuyChips,
      previewParticipantCount: 4,
      venueCost: settings.venueCost,
      firstPlaceCost: settings.firstPlaceCost,
      secondPlaceCost: settings.secondPlaceCost,
      thirdPlaceCost: settings.thirdPlaceCost,
      costShares: settings.costShares,
      sevenDeuceRuleEnabled: true,
      bombPotRuleEnabled: true,
    });
    mocked.lockParticipants.mockResolvedValue(
      ["A", "B", "C", "D"].map((displayName, index) => ({
        groupPlayerId: `group-player-${index + 1}`,
        displayName,
        remainingChips: 20_000,
        totalRebuyCount: 0,
        outstandingRebuyCount: 0,
        settlementRebuyCount: 0,
      })),
    );
    mocked.saveCostSettings.mockResolvedValue(true);
    mocked.markFinalized.mockResolvedValue(true);
    mocked.notifyGameFinalized.mockImplementation(async () => {
      mocked.events.push("notified");
    });
  });

  it("確定コミット後に結果通知を送る", async () => {
    await expect(
      finalizeGame(group, gameId, settings, false, false),
    ).resolves.toEqual({ ok: true });

    expect(mocked.events).toEqual(["committed", "notified"]);
    expect(mocked.notifyGameFinalized).toHaveBeenCalledWith({
      gameId,
      groupId: group.id,
      groupName: group.name,
      groupPublicCode: group.publicCode,
      playedAt: settings.playedAt,
      title: settings.title,
    });
  });

  it("通知失敗でも確定結果を成功として返す", async () => {
    mocked.notifyGameFinalized.mockRejectedValue(new Error("push failed"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      finalizeGame(group, gameId, settings, false, false),
    ).resolves.toEqual({ ok: true });
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to notify participants about finalized results",
      expect.objectContaining({ errorType: "Error", gameId }),
    );
    consoleError.mockRestore();
  });
});
