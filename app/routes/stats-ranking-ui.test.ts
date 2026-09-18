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

describe("ranking row layout", () => {
  const css = readFileSync("app/styles/stats.css", "utf8");
  const source = readFileSync("app/routes/stats-index.tsx", "utf8");

  it("reserves the same title slot and renders a decorative placeholder without an equipped title", () => {
    expect(source).toContain('className="stats-achievement-slot"');
    expect(source).toContain('className="stats-achievement-placeholder"');
    expect(source).toContain('aria-hidden="true"');
    expect(source).toMatch(/stats-achievement-placeholder[\s\S]*?—/);

    const slotRule = css.match(/\.stats-ranking-section \.stats-achievement-slot\s*\{([^}]+)\}/)?.[1];
    expect(slotRule).toMatch(/min-height:\s*25px;/);

    const placeholderRule = css.match(/\.stats-ranking-section \.stats-achievement-placeholder\s*\{([^}]+)\}/)?.[1];
    expect(placeholderRule).toMatch(/min-height:\s*23px;/);
    expect(placeholderRule).toMatch(/border:\s*1px dashed/);
  });

  it("shares the tallest content-driven row height regardless of equipped titles", () => {
    const listRule = css.match(/\.stats-ranking-section \.stats-ranking-list\s*\{([^}]+)\}/)?.[1];
    expect(listRule).toMatch(/grid-auto-rows:\s*1fr;/);
    expect(listRule).not.toMatch(/(?:^|[;\n])\s*(?:height|max-height):/);
  });

  it("uses common minimum heights on desktop and mobile, not rank-specific heights", () => {
    const cardRules = [...css.matchAll(/\.stats-ranking-section \.stats-ranking-card\s*\{([^}]+)\}/g)]
      .map((match) => match[1]);
    expect(cardRules[0]).toMatch(/min-height:\s*88px;/);
    expect(cardRules[1]).toMatch(/min-height:\s*84px;/);
    for (const rule of cardRules) {
      expect(rule).not.toMatch(/(?:^|[;\n])\s*(?:height|max-height):/);
    }
    const topThreeRules = [...css.matchAll(/\.stats-ranking-section \.stats-ranking-card\.is-top-three\s*\{([^}]+)\}/g)]
      .map((match) => match[1]);
    expect(topThreeRules).toHaveLength(1);
    expect(topThreeRules[0]).toContain("background:");
    expect(topThreeRules[0]).not.toMatch(/(?:^|[;\n])\s*(?:height|min-height|max-height):/);
  });
});
