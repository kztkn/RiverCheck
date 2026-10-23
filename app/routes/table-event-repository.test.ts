import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  queryDatabase: vi.fn(),
  withTransaction: vi.fn(),
}));

vi.mock("@server/db/client.server", () => ({
  queryDatabase: mocked.queryDatabase,
  withTransaction: mocked.withTransaction,
}));

import { cancelTableEvent, createStandUpLoserTableEvent } from "@server/repositories/table-event-repository.server";

describe("table event repository", () => {
  beforeEach(() => vi.resetAllMocks());

  it("STAND UPは開催に参加したプレイヤーだけをopen中に記録する", async () => {
    mocked.queryDatabase.mockResolvedValue({ rows: [{ id: "recorded" }], rowCount: 1 });
    const input = {
      actor: { groupPlayerId: "player-2", type: "participant" as const },
      commandId: "command-1",
      gameId: "game-1",
      groupId: "group-1",
      subjectGroupPlayerId: "player-1",
    };
    await expect(createStandUpLoserTableEvent(input)).resolves.toBe("recorded");
    const [sql, params] = mocked.queryDatabase.mock.calls[0] ?? [];
    expect(String(sql)).toContain("'stand_up_loser'");
    expect(String(sql)).toContain("INNER JOIN game_participants");
    expect(String(sql)).toContain("game.status = 'open'");
    expect(String(sql)).toContain("ON CONFLICT (command_id) DO NOTHING");
    expect(params).toEqual(["game-1", "group-1", "command-1", "player-1", "player-2", "participant"]);
  });

  it("STAND UPの重複コマンドは新しい記録を作らない", async () => {
    mocked.queryDatabase.mockResolvedValue({ rows: [], rowCount: 0 });
    await expect(createStandUpLoserTableEvent({
      actor: { groupPlayerId: null, type: "organizer" },
      commandId: "same-command", gameId: "game-1", groupId: "group-1",
      subjectGroupPlayerId: "player-1",
    })).resolves.toBeNull();
  });

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
    expect(String(sql)).toContain("canceled_by_group_player_id = $4::uuid");
    expect(String(sql)).toContain("canceled_by_type = $5::text");
    expect(String(sql)).toContain("$5::text = 'organizer'");
    expect(params).toEqual([
      "game-1",
      "group-1",
      "event-1",
      "player-1",
      "participant",
    ]);
  });
});
