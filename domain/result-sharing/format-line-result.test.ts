import { describe, expect, it } from "vitest";
import { formatLineResult } from "./format-line-result";

describe("formatLineResult", () => {
  it("計算説明を付けず合計、順位、損益BB、負担額を整形する", () => {
    expect(
      formatLineResult(
        "8月8日 ポーカー会",
        [
          {
            displayName: "A",
            score: 40_000,
            rank: 1,
            costShare: 0,
          },
          {
            displayName: "B",
            score: 20_000,
            rank: 2,
            costShare: 500,
          },
          {
            displayName: "C",
            score: 10_000,
            rank: 3,
            costShare: 1_000,
          },
          {
            displayName: "D",
            score: 0,
            rank: 4,
            costShare: 8_500,
          },
        ],
        20_000,
      ),
    ).toBe(`【8月8日 ポーカー会】
合計：10,000円（4人）

🥇1位：A +100BB 0円
🥈2位：B 0BB 500円
🥉3位：C -50BB 1,000円
4位：D -100BB 8,500円`);
  });

  it("BBレート有効時は最終精算とゲーム・会費の内訳を整形する", () => {
    expect(
      formatLineResult(
        "9月の会",
        [
          {
            displayName: "A",
            score: 80_000,
            rank: 1,
            costShare: 500,
            gameSettlementAmount: 1_500,
          },
          {
            displayName: "B",
            score: -40_000,
            rank: 2,
            costShare: 2_500,
            gameSettlementAmount: -1_500,
          },
        ],
        20_000,
        5,
      ),
    ).toBe(`【9月の会】
会費合計：3,000円（2人） / 1BB = 5円

🥇1位：A +300BB 最終 +1,000円（ゲーム +1,500円 / 会費 -500円）
🥈2位：B -300BB 最終 -4,000円（ゲーム -1,500円 / 会費 -2,500円）`);
  });
});
