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
  expect(html).toContain('通算');
  expect(html).toContain("2027 S1");
  expect(html).not.toContain("シーズン確定の確認");
  router.dispose();
});

vi.mock('@server/services/season-service.server',()=>({getSeasonOverview:vi.fn(async()=>({selectedSeason:{key:'2026'}}))}));
it('明示選択をCookieへ保存し、HTML応答にもSet-Cookieを引き継ぐ',async()=>{
  const {loader,headers}=await import('./stats-index');
  const result=await loader({request:new Request('https://test/g/test/stats?season=2026'),params:{groupCode:'test'}} as never);
  const loaderHeaders=new Headers(result.init?.headers);
  expect(loaderHeaders.get('Set-Cookie')).toContain('rc_rank_period_test=2026');
  expect(headers({loaderHeaders} as never).get('Set-Cookie')).toContain('rc_rank_period_test=2026');
});
