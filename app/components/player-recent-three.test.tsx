import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import {
  PlayerRecentThree,
  summarizeRecentThreeGames,
} from "./player-recent-three";
import type { PlayerGameStat } from "@shared-types/player-stats";

describe("PlayerRecentThree", () => {
  it("shows only the latest three games and their combined BB without a ranking metric", () => {
    const games = [
      game("g1", "古い開催", "2026-06-01T12:00:00.000Z", 10),
      game("g2", "第2回", "2026-07-01T12:00:00.000Z", 20),
      game("g3", "第3回", "2026-08-01T12:00:00.000Z", -5),
      game("g4", "最新回", "2026-09-01T12:00:00.000Z", 15),
    ];

    expect(summarizeRecentThreeGames(games).totalNetBb).toBe(30);

    const markup = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(PlayerRecentThree, {
          games,
          groupCode: "river-check",
        }),
      ),
    );

    expect(markup).toContain("直近3戦");
    expect(markup).toContain("+30BB");
    expect(markup).toContain("最新回");
    expect(markup).toContain("第3回");
    expect(markup).toContain("第2回");
    expect(markup).not.toContain("古い開催");
    expect(markup).not.toContain("ランキング");
  });
});

function game(
  gameId: string,
  gameTitle: string,
  playedAt: string,
  netBb: number,
): PlayerGameStat {
  return {
    cumulativeNetBb: 0,
    gameId,
    gameTitle,
    netBb,
    playedAt,
    rank: 2,
    settlementRebuyCount: 0,
    totalRebuyCount: 0,
  };
}
