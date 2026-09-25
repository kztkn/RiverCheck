import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FinalResults } from "./final-results";
import type {
  GameResultRevision,
  GameResultSummary,
} from "@shared-types/result";

describe("FinalResults settlement visibility", () => {
  const results: GameResultSummary[] = [
    {
      costShare: 1500,
      gameSettlementAmount: 0,
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
      gameSettlementAmount: 0,
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
        bigBlindChips: 200,
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
    expect(markup).not.toContain("1,500P");
    expect(markup).not.toContain("2,500P");
    expect(markup).not.toContain("4,000P");
    expect(markup).not.toContain("トータル");
    expect(markup).not.toContain("負担合計");
    expect(markup).not.toContain("訂正履歴");
  });

  it("keeps settlement amounts for internal result views", () => {
    const markup = renderToStaticMarkup(
      createElement(FinalResults, {
        bigBlindChips: 200,
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

    expect(markup).toContain("1,500P");
    expect(markup).toContain("2,500P");
    expect(markup).toContain("4,000P");
    expect(markup).toContain("トータル");
  });

  it("BB結果の反映が有効なら最終結果とゲーム・負担の内訳を表示する", () => {
    const markup = renderToStaticMarkup(
      createElement(FinalResults, {
        bbRate: 5,
        bigBlindChips: 200,
        groupCode: "river-check",
        initialChips: 20_000,
        lineText: "",
        linkPlayerProfiles: false,
        payPay: null,
        playedAt: "2026-09-20T12:00:00.000Z",
        results: [
          { ...results[0], gameSettlementAmount: 1_500 },
          { ...results[1], gameSettlementAmount: -1_500 },
        ],
        revisions: [],
        shareUrl: "https://example.com/r/result",
        showSettlementAmounts: true,
        showSharePanel: false,
      }),
    );

    expect(markup).toContain("ゲーム結果 1BB = 5P");
    expect(markup).toContain("0P");
    expect(markup).toContain("-4,000P");
    expect(markup).toContain("ゲーム +1,500P / 負担 -1,500P");
    expect(markup).toContain("負担合計");
    expect(markup).not.toContain(">トータル<");
  });

  it("PayPay受取人を小さな星と送金先名で明示する", () => {
    const markup = renderToStaticMarkup(
      createElement(FinalResults, {
        bigBlindChips: 200,
        groupCode: "river-check",
        initialChips: 20_000,
        lineText: "",
        linkPlayerProfiles: false,
        payPay: {
          link: "https://pay.paypay.ne.jp/example",
          ownerDisplayName: "Alice",
          ownerGroupPlayerId: "player-1",
          paymentAmount: 1_500,
          paymentAvailable: true,
        },
        playedAt: "2026-09-20T12:00:00.000Z",
        results,
        revisions: [],
        shareUrl: "https://example.com/r/result",
      }),
    );

    expect(markup).toContain("PayPay受取人");
    expect(markup).toContain("Aliceに送金");
    expect(markup).not.toContain("Bobに送金");
  });
});
