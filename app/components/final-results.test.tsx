import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { FinalResults } from "./final-results";

describe("FinalResults", () => {
  it("初期スタックを0BBとして値と色を表示する", () => {
    const markup = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(FinalResults, {
          groupCode: "river-check",
          initialChips: 20_000,
          lineText: "",
          payPay: null,
          playedAt: "2026-08-21T10:00:00.000Z",
          results: [
            result("a", "A", 1, 40_000),
            result("b", "B", 2, 20_000),
            result("c", "C", 3, 10_000),
            result("d", "D", 4, 0),
          ],
          revisions: [],
          shareUrl: "https://example.com/r/result-code",
          showSharePanel: false,
        }),
      ),
    );

    expect(markup).toContain(
      'result-score result-score-positive">+100BB',
    );
    expect(markup).toContain(
      'result-score result-score-neutral">0BB',
    );
    expect(markup).toContain(
      'result-score result-score-negative">-50BB',
    );
    expect(markup).toContain(
      'result-score result-score-negative">-100BB',
    );
  });
});

function result(
  groupPlayerId: string,
  displayName: string,
  rank: number,
  score: number,
) {
  return {
    costShare: rank * 100,
    displayName,
    groupPlayerId,
    rank,
    remainingChips: Math.max(score, 0),
    score,
    settlementRebuyCount: 0,
    totalRebuyCount: 0,
    trackedOutstandingRebuyCount: 0,
  };
}
