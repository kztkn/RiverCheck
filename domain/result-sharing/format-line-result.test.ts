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
});
