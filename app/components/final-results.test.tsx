import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FinalResults } from "./final-results";
import type { GameResultRevision, GameResultSummary } from "@shared-types/result";

describe("FinalResults settlement visibility", () => {
  const results: GameResultSummary[] = [
    {
      costShare: 1500,
      displayName: "Alice",
      groupPlayerId: "player-1",
      rank: 1,
      remainingChips: 30000,
      score: 10000,
      settlementRebuyCount: 0,
      totalRebuyCount: 0,
      trackedOutstandingRebuyCount: 0,
    },
    {
      costShare: 2500,
      displayName: "Bob",
      groupPlayerId: "player-2",
      rank: 2,
      remainingChips: 10000,
      score: -10000,
      settlementRebuyCount: 0,
      totalRebuyCount: 0,
      trackedOutstandingRebuyCount: 0,
    },
  ];

  const revisions: GameResultRevision[] = [
    {
      id: "revision-1",
      revisionNumber: 1,
      correctedAt: "2026-09-20T12:00:00.000Z",
      beforeResults: [{ ...results[0], costShare: 2000 }],
      afterResults: [{ ...results[0], costShare: 1500 }],
    },
  ];

  it("keeps BB and player details but hides settlement amounts for public guests", () => {
    const markup = renderToStaticMarkup(
      createElement(FinalResults, {
        groupCode: "river-check",
        initialChips: 20000,
        lineText: "",
        linkPlayerProfiles: false,
        payPay: null,
        playedAt: "2026-09-20T12:00:00.000Z",
        results,
        revisions,
        shareUrl: "https://example.com/r/result",
        showSettlementAmounts: false,
        showSharePanel: false,
      }),
    );

    expect(markup).toContain("Alice");
    expect(markup).toContain("Bob");
    expect(markup).toContain("-50BB");
    expect(markup).toContain("-150BB");
    expect(markup).toContain("1BB = 200チップ");
    expect(markup).not.toContain("1,500円");
    expect(markup).not.toContain("2,500円");
    expect(markup).not.toContain("4,000円");
    expect(markup).not.toContain("トータル");
    expect(markup).not.toContain("会費");
    expect(markup).not.toContain("訂正履歴");
  });

  it("keeps settlement amounts for internal result views", () => {
    const markup = renderToStaticMarkup(
      createElement(FinalResults, {
        groupCode: "river-check",
        initialChips: 20000,
        lineText: "",
        linkPlayerProfiles: false,
        payPay: null,
        playedAt: "2026-09-20T12:00:00.000Z",
        results,
        revisions: [],
        shareUrl: "https://example.com/r/result",
        showSettlementAmounts: true,
        showSharePanel: false,
      }),
    );

    expect(markup).toContain("1,500円");
    expect(markup).toContain("2,500円");
    expect(markup).toContain("4,000円");
    expect(markup).toContain("トータル");
  });
});
