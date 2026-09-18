import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RankingPosition } from "../components/ranking-position";

describe("ranking movement UI", () => {
  it.each([
    {
      rank: 3,
      previousRank: 5,
      symbol: "↑2",
      label: "前回5位から2位上昇",
    },
    {
      rank: 5,
      previousRank: 3,
      symbol: "↓2",
      label: "前回3位から2位下降",
    },
    {
      rank: 3,
      previousRank: 3,
      symbol: "—",
      label: "前回比：順位変動なし",
    },
  ])("renders $symbol without relying on color", ({ rank, previousRank, symbol, label }) => {
    const markup = renderToStaticMarkup(createElement(RankingPosition, { rank, previousRank }));
    expect(markup).toContain(symbol);
    expect(markup).toContain(`aria-label="${label}"`);
    expect(markup).not.toMatch(/bb-positive|bb-negative/);
  });

  it("does not show NEW or a misleading unchanged marker for a missing previous rank", () => {
    const markup = renderToStaticMarkup(createElement(RankingPosition, { rank: 1, previousRank: null }));
    expect(markup).toContain("1st");
    expect(markup).not.toContain("NEW");
    expect(markup).not.toContain("—");
  });

});
