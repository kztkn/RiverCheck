import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  queryDatabase: vi.fn(),
}));

vi.mock("@server/db/client.server", () => ({
  queryDatabase: mocked.queryDatabase,
  withTransaction: vi.fn(),
}));

import { hasMultipleActiveGroupsForPlayer } from "@server/repositories/group-repository.server";

describe("hasMultipleActiveGroupsForPlayer", () => {
  beforeEach(() => vi.resetAllMocks());

  it("有効な所属が2件以上ならtrueを返す", async () => {
    mocked.queryDatabase.mockResolvedValue({
      rows: [{ has_multiple_groups: true }],
    });

    await expect(hasMultipleActiveGroupsForPlayer("player-1")).resolves.toBe(true);

    const sql = String(mocked.queryDatabase.mock.calls[0]?.[0]);
    expect(sql).toContain("COUNT(*) > 1");
    expect(sql).toContain("is_active = TRUE");
    expect(mocked.queryDatabase).toHaveBeenCalledWith(expect.any(String), [
      "player-1",
    ]);
  });

  it("所属が1件以下ならfalseを返す", async () => {
    mocked.queryDatabase.mockResolvedValue({
      rows: [{ has_multiple_groups: false }],
    });

    await expect(hasMultipleActiveGroupsForPlayer("player-1")).resolves.toBe(false);
  });
});
