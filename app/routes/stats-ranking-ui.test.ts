import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RankingPosition } from "../components/ranking-position";

describe("ranking movement UI", () => {
  it.each([
    { rank: 3, previousRank: 5, symbol: "↑2", label: "前回5位から2位上昇" },
    { rank: 5, previousRank: 3, symbol: "↓2", label: "前回3位から2位下降" },
    { rank: 3, previousRank: 3, symbol: "—", label: "前回比：順位変動なし" },
  ])("renders $symbol without relying on color", ({ rank, previousRank, symbol, label }) => {
    const markup = renderToStaticMarkup(createElement(RankingPosition, { rank, previousRank }));
    expect(markup).toContain(symbol);
    expect(markup).toContain(`aria-label="${label}"`);
    expect(markup).not.toMatch(/bb-positive|bb-negative/);
  });

  it.each([
    { rank: 1, previousRank: 7, direction: "up", symbol: "↑6" },
    { rank: 3, previousRank: 1, direction: "down", symbol: "↓2" },
    { rank: 1, previousRank: 13, direction: "up", symbol: "↑12" },
    { rank: 13, previousRank: 1, direction: "down", symbol: "↓12" },
  ])("adds the $direction badge for $symbol", ({ rank, previousRank, direction, symbol }) => {
    const markup = renderToStaticMarkup(createElement(RankingPosition, { rank, previousRank }));
    expect(markup).toContain(`class="stats-rank-change stats-rank-change--${direction}"`);
    expect(markup).toContain(symbol);
  });

  it("keeps unchanged ranks muted without a movement badge", () => {
    const markup = renderToStaticMarkup(createElement(RankingPosition, { rank: 2, previousRank: 2 }));
    expect(markup).toContain('class="stats-rank-change"');
    expect(markup).toContain("—");
    expect(markup).not.toContain("stats-rank-change--");
  });

  it("does not show NEW or a misleading unchanged marker for a missing previous rank", () => {
    const markup = renderToStaticMarkup(createElement(RankingPosition, { rank: 1, previousRank: null }));
    expect(markup).toContain("1st");
    expect(markup).not.toContain("stats-rank-change");
    expect(markup).not.toContain("NEW");
    expect(markup).not.toContain("—");
  });

  it("keeps max win/loss at the right end and uses the selected metric's previous rank", () => {
    const source = readFileSync("app/routes/stats-index.tsx", "utf8");
    expect([...source.matchAll(/value: "([a-z-]+)", label:/g)].map((match) => match[1]))
      .toEqual(["total", "average", "recent", "top-three", "rank-rate", "max-win", "max-loss"]);
    expect(source).toContain("rankPlayers(ranking, activeSort)");
    expect(source).toContain("previousRank={player.previousRanks[activeSort]}");
    expect(source).toContain("window.history.replaceState");
    expect(source).not.toContain("function rankPlayers(");
  });
});
