import { describe, expect, it, vi } from "vitest";

vi.mock("@server/services/player-stats-service.server", () => ({
  getPlayerStatsRanking: vi.fn(),
  parsePlayerStatsSort: vi.fn(),
}));

import { getRankingMetric } from "./stats-index";

describe("stats ranking metric", () => {
  it("TOP3回数と順位決定に使う優勝・2位回数を表示する", () => {
    expect(getRankingMetric({
      topThreeFinishes: 4,
      wins: 1,
      secondPlaceFinishes: 2,
    } as never, "top-three")).toEqual({
      label: "TOP3入り",
      value: "4回",
      tone: "",
      detail: "優勝1回・2位2回",
    });
  });
});
