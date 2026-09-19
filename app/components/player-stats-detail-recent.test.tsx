import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  calculateRecentThreeNetBb,
  PlayerStatsOverview,
} from "./player-stats-detail";
import type {
  PlayerGameStat,
  PlayerStatsSummary,
} from "@shared-types/player-stats";

describe("player stats recent form", () => {
  it("calculates only the latest three games", () => {
    expect(
      calculateRecentThreeNetBb([
        game("g1", 10),
        game("g2", 20),
        game("g3", -5),
        game("g4", 15),
      ]),
    ).toBe(30);
    expect(calculateRecentThreeNetBb([])).toBeNull();
  });

  it("shows the recent-three BB inside the performance summary without duplicating game rows", () => {
    const markup = renderToStaticMarkup(
      createElement(PlayerStatsOverview, {
        recentThreeNetBb: -33.5,
        summary: summary(),
      }),
    );

    expect(markup).toContain("戦績サマリー");
    expect(markup).toContain("直近3戦");
    expect(markup).toContain("-33.5BB");
    expect(markup).not.toContain("RECENT FORM");
    expect(markup).not.toContain("開催");
  });
});

function game(gameId: string, netBb: number): PlayerGameStat {
  return {
    cumulativeNetBb: 0,
    gameId,
    gameTitle: gameId,
    netBb,
    playedAt: "2026-09-01T12:00:00.000Z",
    rank: 2,
    settlementRebuyCount: 0,
    totalRebuyCount: 0,
  };
}

function summary(): PlayerStatsSummary {
  return {
    avatarUpdatedAt: null,
    averageNetBb: 44.5,
    displayName: "kazuto",
    favoriteCard1: null,
    favoriteCard2: null,
    gamesPlayed: 5,
    groupPlayerId: "player-1",
    maxLossBb: -100,
    maxWinBb: 180,
    positiveFinishes: 3,
    positiveRate: 60,
    profileMessage: null,
    topThreeFinishes: 2,
    topThreeRate: 40,
    totalNetBb: 222.5,
    wins: 1,
  };
}
