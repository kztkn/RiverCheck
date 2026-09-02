import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  awardAchievementsForPlayers: vi.fn(),
  deleteFinalResultsForReopen: vi.fn(),
  getFinalizationReopenBlockers: vi.fn(),
  lockFinalResults: vi.fn(),
  lockGameForFinalization: vi.fn(),
  lockParticipantsForFinalization: vi.fn(),
  markGameOpenAfterFinalization: vi.fn(),
}));

vi.mock("@server/db/client.server", () => ({
  withTransaction: vi.fn(async (callback) => callback({ query: vi.fn() })),
}));
vi.mock("@server/repositories/finalization-repository.server", () => ({
  ...mocked,
}));
vi.mock("@server/services/achievement-service.server", () => ({
  awardAchievementsForPlayers: mocked.awardAchievementsForPlayers,
}));
vi.mock("@server/services/push-notification-service.server", () => ({
  notifyGameFinalized: vi.fn(),
}));
vi.mock("@server/repositories/game-cost-share-receipt-repository.server", () => ({
  clearChangedCostShareReceipts: vi.fn(),
}));

import { reopenFinalizedGame } from "@server/services/finalization-service.server";

const game = {
  id: "game-1", groupId: "group-1", title: "Test",
  playedAt: "2026-09-03T00:00:00.000Z", status: "finalized" as const,
  initialChips: 20000, rebuyChips: 20000, previewParticipantCount: 4,
  venueCost: 0, firstPlaceCost: 0, secondPlaceCost: 0, thirdPlaceCost: 0,
  costShares: [0, 0, 0, 0], sevenDeuceRuleEnabled: true, bombPotRuleEnabled: true,
};
const ids = ["p1", "p2", "p3", "p4"];

beforeEach(() => {
  vi.clearAllMocks();
  mocked.lockGameForFinalization.mockResolvedValue(game);
  mocked.lockParticipantsForFinalization.mockResolvedValue(
    ids.map((id) => ({ group_player_id: id })),
  );
  mocked.getFinalizationReopenBlockers.mockResolvedValue({
    hasResultRevisions: false,
    hasCostShareReceipts: false,
    hasStoryPosts: false,
  });
  mocked.lockFinalResults.mockResolvedValue(
    ids.map((id, index) => ({ groupPlayerId: id, rank: index + 1 })),
  );
  mocked.markGameOpenAfterFinalization.mockResolvedValue(true);
});

describe("reopenFinalizedGame", () => {
  it("removes only final results, reopens the game, and recalculates achievements", async () => {
    await expect(reopenFinalizedGame("group-1", "game-1")).resolves.toEqual({ ok: true });
    expect(mocked.deleteFinalResultsForReopen).toHaveBeenCalledWith(expect.anything(), "game-1");
    expect(mocked.markGameOpenAfterFinalization).toHaveBeenCalledWith(
      expect.anything(), "group-1", "game-1",
    );
    expect(mocked.awardAchievementsForPlayers).toHaveBeenCalledWith(
      expect.anything(), "group-1", ids,
    );
  });

  it.each([
    ["hasResultRevisions", "結果訂正履歴"],
    ["hasCostShareReceipts", "会費受取記録"],
    ["hasStoryPosts", "TABLE STORIES"],
  ] as const)("blocks reopen when %s exists", async (key, label) => {
    mocked.getFinalizationReopenBlockers.mockResolvedValue({
      hasResultRevisions: false,
      hasCostShareReceipts: false,
      hasStoryPosts: false,
      [key]: true,
    });
    const result = await reopenFinalizedGame("group-1", "game-1");
    expect(result).toEqual({
      ok: false,
      error: expect.stringContaining(label),
    });
    expect(mocked.deleteFinalResultsForReopen).not.toHaveBeenCalled();
    expect(mocked.markGameOpenAfterFinalization).not.toHaveBeenCalled();
  });

  it("fails closed when participant and result sets are inconsistent", async () => {
    mocked.lockFinalResults.mockResolvedValue(
      ids.slice(0, 3).map((id, index) => ({ groupPlayerId: id, rank: index + 1 })),
    );
    await expect(reopenFinalizedGame("group-1", "game-1")).resolves.toEqual({
      ok: false,
      error: "確定データの整合性を確認できないため、確定を取り消せません。",
    });
    expect(mocked.deleteFinalResultsForReopen).not.toHaveBeenCalled();
  });
});
