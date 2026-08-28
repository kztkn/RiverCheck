import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  lockCostShareForReceipt: vi.fn(),
  setGameCostShareReceived: vi.fn(),
  transaction: {},
  withTransaction: vi.fn(),
}));

vi.mock("@server/db/client.server", () => ({
  withTransaction: mocked.withTransaction,
}));
vi.mock("@server/repositories/game-cost-share-receipt-repository.server", () => ({
  lockCostShareForReceipt: mocked.lockCostShareForReceipt,
  setGameCostShareReceived: mocked.setGameCostShareReceived,
}));

import { updateGameCostShareReceipt } from "@server/services/game-cost-share-receipt-service.server";

describe("game cost share receipt service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocked.withTransaction.mockImplementation(
      async (operation: (transaction: object) => Promise<unknown>) =>
        operation(mocked.transaction),
    );
  });

  it("確定結果の会費をロックして受取済みを保存する", async () => {
    mocked.lockCostShareForReceipt.mockResolvedValue(1_500);

    await expect(
      updateGameCostShareReceipt("group-1", "game-1", "player-1", true),
    ).resolves.toEqual({ ok: true });

    expect(mocked.lockCostShareForReceipt).toHaveBeenCalledWith(
      mocked.transaction,
      "group-1",
      "game-1",
      "player-1",
    );
    expect(mocked.setGameCostShareReceived).toHaveBeenCalledWith(
      mocked.transaction,
      "game-1",
      "player-1",
      true,
    );
  });

  it("0円の参加者を受取済みにはしない", async () => {
    mocked.lockCostShareForReceipt.mockResolvedValue(0);

    await expect(
      updateGameCostShareReceipt("group-1", "game-1", "player-1", true),
    ).resolves.toEqual({
      ok: false,
      error: "0円の参加者は回収対象外です。",
    });
    expect(mocked.setGameCostShareReceived).not.toHaveBeenCalled();
  });

  it("確定結果にない参加者は更新しない", async () => {
    mocked.lockCostShareForReceipt.mockResolvedValue(null);

    await expect(
      updateGameCostShareReceipt("group-1", "game-1", "player-1", false),
    ).resolves.toEqual({
      ok: false,
      error: "会費の回収対象を確認できませんでした。画面を更新してください。",
    });
    expect(mocked.setGameCostShareReceived).not.toHaveBeenCalled();
  });

  it("保存失敗を画面表示用のエラーへ変換する", async () => {
    mocked.withTransaction.mockRejectedValue(new Error("database failed"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      updateGameCostShareReceipt("group-1", "game-1", "player-1", true),
    ).resolves.toEqual({
      ok: false,
      error: "会費の回収状況を保存できませんでした。時間をおいて再度お試しください。",
    });
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to update game cost share receipt",
      { errorType: "Error", gameId: "game-1" },
    );
    consoleError.mockRestore();
  });
});
