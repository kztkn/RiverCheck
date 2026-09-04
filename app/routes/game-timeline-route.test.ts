import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  findGroupByPublicCode: vi.fn(),
  listFinalizedGameTimeline: vi.fn(),
  listFinalizedGameTableEvents: vi.fn(),
}));

vi.mock("@server/repositories/group-repository.server", () => ({
  findGroupByPublicCode: mocked.findGroupByPublicCode,
}));
vi.mock("@server/repositories/game-timeline-repository.server", () => ({
  listFinalizedGameTimeline: mocked.listFinalizedGameTimeline,
}));
vi.mock("@server/repositories/table-event-repository.server", () => ({
  listFinalizedGameTableEvents: mocked.listFinalizedGameTableEvents,
}));

import { loader } from "./game-timeline";

describe("game timeline route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocked.findGroupByPublicCode.mockResolvedValue({
      id: "group-1",
      publicCode: "river-check",
    });
    mocked.listFinalizedGameTimeline.mockResolvedValue([]);
    mocked.listFinalizedGameTableEvents.mockResolvedValue([]);
  });

  it("リバイ記録とテーブルイベントを時刻順で返す", async () => {
    mocked.listFinalizedGameTimeline.mockResolvedValue([
      {
        avatarUpdatedAt: "2026-08-20T00:00:00.000Z",
        displayName: "Alice",
        groupPlayerId: "player-1",
        id: "rebuy-1",
        recordedAt: "2026-08-28T10:42:00.000Z",
        type: "rebuy",
      },
    ]);
    mocked.listFinalizedGameTableEvents.mockResolvedValue([
      {
        id: "table-1",
        type: "seven_deuce",
        recordedAt: "2026-08-28T10:40:00.000Z",
        recordedByGroupPlayerId: "player-2",
        recordedByType: "participant",
        subject: {
          groupPlayerId: "player-2",
          displayName: "Bob",
          avatarUpdatedAt: null,
        },
        players: [],
      },
    ]);

    const response = await loader({
      params: { gameId: "game-1", groupCode: "river-check" },
    } as never);

    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const body = (await response.json()) as { events: Array<{ id: string; type: string }> };
    expect(body.events.map((event) => event.id)).toEqual(["table-1", "rebuy-1"]);
    expect(body.events[0]).toMatchObject({ type: "seven_deuce" });
    expect(body.events[1]).toMatchObject({
      type: "rebuy",
      groupPlayerId: "player-1",
      avatarUrl:
        "/g/river-check/players/player-1/avatar?v=2026-08-20T00%3A00%3A00.000Z",
    });
    expect(mocked.listFinalizedGameTimeline).toHaveBeenCalledWith("group-1", "game-1");
    expect(mocked.listFinalizedGameTableEvents).toHaveBeenCalledWith("group-1", "game-1");
  });

  it("存在しないグループは404にする", async () => {
    mocked.findGroupByPublicCode.mockResolvedValue(null);

    await expect(
      loader({
        params: { gameId: "game-1", groupCode: "missing" },
      } as never),
    ).rejects.toMatchObject({ status: 404 });
    expect(mocked.listFinalizedGameTimeline).not.toHaveBeenCalled();
    expect(mocked.listFinalizedGameTableEvents).not.toHaveBeenCalled();
  });
});
