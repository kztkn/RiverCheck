import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  queryDatabase: vi.fn(),
}));

vi.mock("@server/db/client.server", () => ({
  queryDatabase: mocked.queryDatabase,
}));

import {
  clearChangedCostShareReceipts,
  listGameCostShareReceipts,
} from "@server/repositories/game-cost-share-receipt-repository.server";

describe("game cost share receipt repository", () => {
  beforeEach(() => vi.resetAllMocks());

  it("確定結果と受取確認を順位順で返す", async () => {
    mocked.queryDatabase.mockResolvedValue({
      rows: [
        {
          cost_share: "0",
          display_name: "Alice",
          group_player_id: "player-1",
          received_at: null,
        },
        {
          cost_share: "500",
          display_name: "Bob",
          group_player_id: "player-2",
          received_at: new Date("2026-08-29T10:00:00.000Z"),
        },
      ],
    });

    await expect(
      listGameCostShareReceipts("group-1", "game-1"),
    ).resolves.toEqual([
      {
        costShare: 0,
        displayName: "Alice",
        groupPlayerId: "player-1",
        receivedAt: null,
      },
      {
        costShare: 500,
        displayName: "Bob",
        groupPlayerId: "player-2",
        receivedAt: "2026-08-29T10:00:00.000Z",
      },
    ]);

    const sql = String(mocked.queryDatabase.mock.calls[0]?.[0]);
    expect(sql).toContain("LEFT JOIN game_cost_share_receipts");
    expect(sql).toContain("game.status = 'finalized'");
    expect(sql).toContain("ORDER BY game_result.rank ASC");
    expect(mocked.queryDatabase).toHaveBeenCalledWith(expect.any(String), [
      "game-1",
      "group-1",
    ]);
  });

  it("訂正で金額が変わった参加者の受取確認を解除する", async () => {
    const transaction = { query: vi.fn().mockResolvedValue({ rows: [] }) };

    await clearChangedCostShareReceipts(
      transaction as never,
      "game-1",
      ["player-2", "player-3"],
    );

    const sql = String(transaction.query.mock.calls[0]?.[0]);
    expect(sql).toContain("DELETE FROM game_cost_share_receipts");
    expect(sql).toContain("ANY($2::UUID[])");
    expect(transaction.query).toHaveBeenCalledWith(expect.any(String), [
      "game-1",
      ["player-2", "player-3"],
    ]);
  });

  it("会費変更がなければ受取確認へ書き込まない", async () => {
    const transaction = { query: vi.fn() };

    await clearChangedCostShareReceipts(transaction as never, "game-1", []);

    expect(transaction.query).not.toHaveBeenCalled();
  });
});
