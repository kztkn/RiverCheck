import { describe, expect, it } from "vitest";
import { formatLineResult } from "./format-line-result";

describe("formatLineResult", () => {
  it("合計、人数、順位、BBスコア、負担額をLINE用に整形する", () => {
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

🥇1位：A +200BB 0円
🥈2位：B +100BB 500円
🥉3位：C +50BB 1,000円
4位：D 0BB 8,500円

※BBスコア＝（残チップ－リバイ数×初期チップ）÷1BB
1BB＝200チップ（初期20,000チップ＝100BB）`);
  });
});
