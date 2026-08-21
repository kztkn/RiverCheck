import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  queryDatabase: vi.fn(),
}));

vi.mock("@server/db/client.server", () => ({
  queryDatabase: mocked.queryDatabase,
}));

import { findFinalizedGamePublicRoute } from "@server/repositories/game-repository.server";

describe("game repository public result route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("確定済み開催のIDとグループ公開コードだけを返す", async () => {
    mocked.queryDatabase.mockResolvedValue({
      rows: [{ id: "game-1", public_code: "river-check" }],
    });

    await expect(findFinalizedGamePublicRoute("game-1")).resolves.toEqual({
      gameId: "game-1",
      groupPublicCode: "river-check",
    });
    const sql = String(mocked.queryDatabase.mock.calls[0]?.[0]);
    expect(sql).toContain("game.status = 'finalized'");
    expect(sql).toContain("INNER JOIN groups");
    expect(mocked.queryDatabase).toHaveBeenCalledWith(
      expect.any(String),
      ["game-1"],
    );
  });

  it("対象がなければnullを返す", async () => {
    mocked.queryDatabase.mockResolvedValue({ rows: [] });

    await expect(
      findFinalizedGamePublicRoute("missing-game"),
    ).resolves.toBeNull();
  });
});
