import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  findGroupByPublicCode: vi.fn(),
  listFinalizedGameTimeline: vi.fn(),
}));

vi.mock("@server/repositories/group-repository.server", () => ({
  findGroupByPublicCode: mocked.findGroupByPublicCode,
}));
vi.mock("@server/repositories/game-timeline-repository.server", () => ({
  listFinalizedGameTimeline: mocked.listFinalizedGameTimeline,
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
  });

  it("確定済み開催のタイムラインをアバターURL付きで返す", async () => {
    mocked.listFinalizedGameTimeline.mockResolvedValue([
      {
        avatarUpdatedAt: "2026-08-20T00:00:00.000Z",
        displayName: "Alice",
        groupPlayerId: "player-1",
        id: "event-1",
        recordedAt: "2026-08-28T10:42:00.000Z",
        type: "rebuy",
      },
    ]);

    const response = await loader({
      params: { gameId: "game-1", groupCode: "river-check" },
    } as never);

    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({
      events: [
        {
          avatarUrl:
            "/g/river-check/players/player-1/avatar?v=2026-08-20T00%3A00%3A00.000Z",
          displayName: "Alice",
          id: "event-1",
          recordedAt: "2026-08-28T10:42:00.000Z",
          type: "rebuy",
        },
      ],
    });
    expect(mocked.listFinalizedGameTimeline).toHaveBeenCalledWith(
      "group-1",
      "game-1",
    );
  });

  it("存在しないグループは404にする", async () => {
    mocked.findGroupByPublicCode.mockResolvedValue(null);

    await expect(
      loader({
        params: { gameId: "game-1", groupCode: "missing" },
      } as never),
    ).rejects.toMatchObject({ status: 404 });
    expect(mocked.listFinalizedGameTimeline).not.toHaveBeenCalled();
  });
});
