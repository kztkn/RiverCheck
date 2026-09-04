import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  queryDatabase: vi.fn(),
  withTransaction: vi.fn(),
}));

vi.mock("@server/db/client.server", () => ({
  queryDatabase: mocked.queryDatabase,
  withTransaction: mocked.withTransaction,
}));

import { cancelTableEvent } from "@server/repositories/table-event-repository.server";

describe("table event repository", () => {
  beforeEach(() => vi.resetAllMocks());

  it("取消SQLのプレースホルダを連番で渡す", async () => {
    mocked.queryDatabase.mockResolvedValue({
      rows: [{ id: "event-1" }],
      rowCount: 1,
    });

    await expect(
      cancelTableEvent({
        actor: { groupPlayerId: "player-1", type: "participant" },
        eventId: "event-1",
        gameId: "game-1",
        groupId: "group-1",
      }),
    ).resolves.toBe(true);

    const [sql, params] = mocked.queryDatabase.mock.calls[0] ?? [];
    expect(String(sql)).toContain("canceled_by_group_player_id = $4");
    expect(String(sql)).toContain("canceled_by_type = $5");
    expect(String(sql)).toContain("$5 = 'organizer'");
    expect(params).toEqual([
      "game-1",
      "group-1",
      "event-1",
      "player-1",
      "participant",
    ]);
  });
});
