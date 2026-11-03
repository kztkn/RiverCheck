import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createMemoryRouter, RouterProvider } from "react-router";
import { it, expect, vi } from "vitest";
vi.mock("@server/services/player-stats-service.server", () => ({
  getPlayerStatsRanking: vi.fn(),
  parsePlayerStatsSort: vi.fn(),
}));
import StatsIndex from "./stats-index";
import { seasonFor } from "@domain/season/season";
it("期間selectは現在・過去・通算を持ち、確定状態が分かる", () => {
  const router = createMemoryRouter([
    {
      path: "/",
      element: createElement(StatsIndex, {
        loaderData: {
          group: { publicCode: "test", name: "test" },
          ranking: [],
          sort: "total",
          selectedSeason: seasonFor(2026),
          seasons: [seasonFor(2027), seasonFor(2026)],
          finalizedAt: "2026-12-20",
          canFinalize: false,
          preview: null,
          version: "",
          unavailable: false,
        },
      } as never),
    },
  ]);
  const html = renderToStaticMarkup(createElement(RouterProvider, { router }));
  expect(html).toContain("2026 FIRST SEASON");
  expect(html).toContain("確定済み");
  expect(html).toContain("2026/06/19");
  expect(html).toContain('value="all"');
  expect(html).toContain("2027 S1");
  expect(html).not.toContain("シーズン確定の確認");
  router.dispose();
});
