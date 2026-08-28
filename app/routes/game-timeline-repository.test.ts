import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  queryDatabase: vi.fn(),
}));

vi.mock("@server/db/client.server", () => ({
  queryDatabase: mocked.queryDatabase,
}));

import { listFinalizedGameTimeline } from "@server/repositories/game-timeline-repository.server";

describe("game timeline repository", () => {
  beforeEach(() => vi.resetAllMocks());

  it("確定済み開催の有効なリバイ・返済だけを時系列で返す", async () => {
    mocked.queryDatabase.mockResolvedValue({
      rows: [
        {
          avatar_uploaded_at: null,
          display_name: "Alice",
          event_type: "rebuy",
          group_player_id: "player-1",
          id: "event-1",
          recorded_at: new Date("2026-08-28T10:42:00.000Z"),
        },
        {
          avatar_uploaded_at: new Date("2026-08-20T00:00:00.000Z"),
          display_name: "Bob",
          event_type: "repayment",
          group_player_id: "player-2",
          id: "event-2",
          recorded_at: new Date("2026-08-28T11:07:00.000Z"),
        },
      ],
    });

    await expect(
      listFinalizedGameTimeline("group-1", "game-1"),
    ).resolves.toEqual([
      {
        avatarUpdatedAt: null,
        displayName: "Alice",
        groupPlayerId: "player-1",
        id: "event-1",
        recordedAt: "2026-08-28T10:42:00.000Z",
        type: "rebuy",
      },
      {
        avatarUpdatedAt: "2026-08-20T00:00:00.000Z",
        displayName: "Bob",
        groupPlayerId: "player-2",
        id: "event-2",
        recordedAt: "2026-08-28T11:07:00.000Z",
        type: "repayment",
      },
    ]);

    const sql = String(mocked.queryDatabase.mock.calls[0]?.[0]);
    expect(sql).toContain("game.status = 'finalized'");
    expect(sql).toContain("event.event_type IN ('rebuy', 'repayment')");
    expect(sql).toContain("undo.reverts_event_id = event.id");
    expect(sql).toContain("ORDER BY event.recorded_at ASC, event.id ASC");
    expect(mocked.queryDatabase).toHaveBeenCalledWith(expect.any(String), [
      "game-1",
      "group-1",
    ]);
  });
});
