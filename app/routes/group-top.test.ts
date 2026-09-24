import { describe, expect, it, vi } from "vitest";
import type { GameListItem } from "@shared-types/game";

const mocked = vi.hoisted(() => ({
  getGroupOverview: vi.fn(),
  getOpenGameTableEventCounts: vi.fn(),
}));

vi.mock("@server/services/group-service.server", () => ({
  getGroupOverview: mocked.getGroupOverview,
}));
vi.mock("@server/repositories/participant-repository.server", () => ({
  getOpenGameTableEventCounts: mocked.getOpenGameTableEventCounts,
}));
vi.mock("~/components/site-menu", () => ({
  GroupSiteHeader: vi.fn(() => null),
}));

import { buildGameUrl, getCreateGameUrl, loader } from "./group-top";

const game = {
  id: "22222222-2222-4222-8222-222222222222",
} as GameListItem;

describe("group top navigation", () => {
  it("受付中が0件の管理者にだけ開催作成URLを返す", () => {
    expect(getCreateGameUrl(0, true, false)).toBe("games/new");
    expect(getCreateGameUrl(1, true, false)).toBeNull();
    expect(getCreateGameUrl(0, false, false)).toBeNull();
    expect(getCreateGameUrl(0, true, true)).toBeNull();
  });

  it("管理者の受付中カードだけ管理画面へ進める", () => {
    expect(buildGameUrl(game, true, false)).toBe(
      `games/${game.id}/admin`,
    );
    expect(buildGameUrl(game, false, false)).toBe(`games/${game.id}`);
    expect(buildGameUrl(game, true, true)).toBe(`games/${game.id}`);
  });

  it("LIVE TABLE集計を待たずにTOPの基本データを返す", async () => {
    const openGame = {
      id: game.id,
      participantCount: 4,
      playedAt: "2099-09-22T03:00:00.000Z",
      status: "open",
      title: "開催中の会",
      winnerName: null,
      createdByPlayerId: null,
    } satisfies GameListItem;
    mocked.getGroupOverview.mockResolvedValue({
      games: [openGame],
      group: {
        id: "group-1",
        lineOpenChatUrl: null,
        name: "River Check",
        payPayLinkRegisteredAt: null,
        payPayRecipientLink: null,
        publicCode: "river-check",
      },
    });
    let resolveCounts: (value: {
      allInCount: number;
      bombPotCount: number;
      sevenDeuceCount: number;
    }) => void = () => undefined;
    mocked.getOpenGameTableEventCounts.mockReturnValue(
      new Promise((resolve) => {
        resolveCounts = resolve;
      }),
    );

    const result = await loader({
      params: { groupCode: "river-check" },
      request: new Request("https://example.com/g/river-check"),
    } as Parameters<typeof loader>[0]);

    expect(result.group.name).toBe("River Check");
    expect(result.liveTable).toBeInstanceOf(Promise);
    await vi.waitFor(() => {
      expect(mocked.getOpenGameTableEventCounts).toHaveBeenCalledWith(
        "group-1",
        game.id,
      );
    });

    resolveCounts({ allInCount: 2, bombPotCount: 1, sevenDeuceCount: 3 });
    await expect(result.liveTable).resolves.toEqual({
      allInCount: 2,
      bombPotCount: 1,
      gameId: game.id,
      playerCount: 4,
      sevenDeuceCount: 3,
    });
  });
});

describe("group top pending navigation", () => {
  it("keeps URL construction independent from pending UI", () => {
    expect(buildGameUrl(game, false, true)).toBe(`games/${game.id}`);
  });
});
