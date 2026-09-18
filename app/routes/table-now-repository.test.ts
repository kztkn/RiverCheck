import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({ queryDatabase: vi.fn() }));

vi.mock("@server/db/client.server", () => ({
  queryDatabase: mocked.queryDatabase,
  withTransaction: vi.fn(),
}));

import { getOpenGameTableEventCounts } from "@server/repositories/participant-repository.server";

describe("TABLE NOW repository", () => {
  beforeEach(() => vi.resetAllMocks());

  it("受付中開催の有効なイベント数を種別ごとに返す", async () => {
    mocked.queryDatabase.mockResolvedValue({
      rows: [{ all_in_count: 3, bomb_pot_count: 2, seven_deuce_count: 1 }],
    });

    await expect(
      getOpenGameTableEventCounts("group-1", "game-1"),
    ).resolves.toEqual({
      allInCount: 3,
      bombPotCount: 2,
      sevenDeuceCount: 1,
    });

    const sql = String(mocked.queryDatabase.mock.calls[0]?.[0]);
    expect(sql).toContain("game.status = 'open'");
    expect(sql).toContain("event.canceled_at IS NULL");
    expect(mocked.queryDatabase).toHaveBeenCalledWith(expect.any(String), [
      "game-1",
      "group-1",
    ]);
  });
});
