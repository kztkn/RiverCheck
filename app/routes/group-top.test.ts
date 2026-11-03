import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createMemoryRouter, RouterProvider } from "react-router";
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

import GroupTop, {
  buildGameUrl,
  getCreateGameUrl,
  getPrimaryGameTiming,
  loader,
  headers,
} from "./group-top";

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

  it("東京日付で主開催を予定・本日・結果待ちに分ける", () => {
    const now = new Date("2026-09-25T23:30:00.000Z");

    expect(
      getPrimaryGameTiming("2026-09-25T15:00:00.000Z", now),
    ).toBe("today");
    expect(
      getPrimaryGameTiming("2026-10-01T15:00:00.000Z", now),
    ).toBe("future");
    expect(
      getPrimaryGameTiming("2026-09-24T15:00:00.000Z", now),
    ).toBe("past");
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
      playedAt: new Date().toISOString(),
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

    const response = await loader({
      params: { groupCode: "river-check" },
      request: new Request("https://example.com/g/river-check"),
    } as Parameters<typeof loader>[0]);
    const result = response.data;

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

describe("年間まとめの期間限定導線", () => {
  afterEach(() => vi.useRealTimers());

  it.each([
    ["2026-11-30T00:00:00+09:00", false],
    ["2026-11-30T23:59:59.999+09:00", false],
    ["2026-12-01T00:00:00+09:00", true],
    ["2027-01-31T23:59:59.999+09:00", true],
    ["2027-02-01T00:00:00+09:00", false],
  ])("JST %s のカード表示は %s", async (now, visible) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(now));
    mocked.getGroupOverview.mockResolvedValue({
      group: { id: "another-group", publicCode: "another-table", name: "別のテーブル" },
      games: [],
    });
    const response = await loader({ params: { groupCode: "another-table" } } as never);
    const loaderData = response.data;
    expect(loaderData.showYearRecap).toBe(visible);

    // Rendering uses the server decision even when the client clock differs.
    vi.setSystemTime(new Date("2030-01-01T00:00:00Z"));
    const router = createMemoryRouter([{
      path: "/", element: createElement(GroupTop, { loaderData } as never),
    }]);
    const markup = renderToStaticMarkup(createElement(RouterProvider, { router }));
    expect(markup.includes("RIVERCHECK WRAPPED 2026")).toBe(visible);
    expect(markup.includes('href="/g/another-table/recap/2026"')).toBe(visible);
    if (visible) {
      expect(markup).toContain("今年のポーカーを振り返ろう。");
      expect(markup).toContain("2026年のまとめを見る");
      expect(markup.indexOf('class="home-current-empty"')).toBeLessThan(markup.indexOf('class="home-wrapped-card"'));
      expect(markup.indexOf('class="home-wrapped-card"')).toBeLessThan(markup.indexOf('class="home-history"'));
    }
    expect(headers()["Cache-Control"]).toBe("private, no-store");
    router.dispose();
  });
});
