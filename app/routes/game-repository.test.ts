import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  queryDatabase: vi.fn(),
}));

vi.mock("@server/db/client.server", () => ({
  queryDatabase: mocked.queryDatabase,
}));

import {
  deleteOpenGame,
  findFinalizedGamePublicRoute,
  updateLocalRules,
  updateOpenGameTitle,
} from "@server/repositories/game-repository.server";

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

describe("game repository local rules", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("受付中の開催だけ72oとボムポットを更新する", async () => {
    mocked.queryDatabase.mockResolvedValue({ rowCount: 1, rows: [] });

    await expect(
      updateLocalRules("group-1", "game-1", {
        sevenDeuceRuleEnabled: true,
        bombPotRuleEnabled: false,
      }),
    ).resolves.toBe(true);

    const sql = String(mocked.queryDatabase.mock.calls[0]?.[0]);
    expect(sql).toContain("seven_deuce_rule_enabled = $3");
    expect(sql).toContain("bomb_pot_rule_enabled = $4");
    expect(sql).toContain("status = 'open'");
    expect(mocked.queryDatabase).toHaveBeenCalledWith(expect.any(String), [
      "game-1",
      "group-1",
      true,
      false,
    ]);
  });

  it("確定済みなど更新対象がなければ失敗を返す", async () => {
    mocked.queryDatabase.mockResolvedValue({ rowCount: 0, rows: [] });

    await expect(
      updateLocalRules("group-1", "game-1", {
        sevenDeuceRuleEnabled: false,
        bombPotRuleEnabled: false,
      }),
    ).resolves.toBe(false);
  });
});

describe("game repository open game management", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("同じグループの受付中開催だけ開催名を変更する", async () => {
    mocked.queryDatabase.mockResolvedValue({ rowCount: 1, rows: [] });

    await expect(
      updateOpenGameTitle("group-1", "game-1", "9月のポーカー会"),
    ).resolves.toBe(true);

    const sql = String(mocked.queryDatabase.mock.calls[0]?.[0]);
    expect(sql).toContain("SET title = $3");
    expect(sql).toContain("group_id = $2");
    expect(sql).toContain("status = 'open'");
    expect(mocked.queryDatabase).toHaveBeenCalledWith(expect.any(String), [
      "game-1",
      "group-1",
      "9月のポーカー会",
    ]);
  });

  it("同じグループの受付中開催だけ削除する", async () => {
    mocked.queryDatabase.mockResolvedValue({ rowCount: 1, rows: [] });

    await expect(deleteOpenGame("group-1", "game-1")).resolves.toBe(true);

    const sql = String(mocked.queryDatabase.mock.calls[0]?.[0]);
    expect(sql).toContain("DELETE FROM games");
    expect(sql).toContain("group_id = $2");
    expect(sql).toContain("status = 'open'");
    expect(mocked.queryDatabase).toHaveBeenCalledWith(expect.any(String), [
      "game-1",
      "group-1",
    ]);
  });

  it("確定済みなど対象外の開催は変更・削除できない", async () => {
    mocked.queryDatabase.mockResolvedValue({ rowCount: 0, rows: [] });

    await expect(
      updateOpenGameTitle("group-1", "game-1", "変更後"),
    ).resolves.toBe(false);
    await expect(deleteOpenGame("group-1", "game-1")).resolves.toBe(false);
  });
});
