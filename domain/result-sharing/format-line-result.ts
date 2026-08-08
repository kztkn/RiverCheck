import { formatBbScore, formatChipsPerBb } from "../score/bb-score";

export interface LineResultEntry {
  displayName: string;
  score: number;
  rank: number;
  costShare: number;
}

export function formatLineResult(
  gameTitle: string,
  results: LineResultEntry[],
  initialChips: number,
): string {
  const settlementTotal = results.reduce(
    (sum, result) => sum + result.costShare,
    0,
  );
  const resultLines = results.map((result) => {
    const medal =
      result.rank === 1
        ? "🥇"
        : result.rank === 2
          ? "🥈"
          : result.rank === 3
            ? "🥉"
            : "";
    return `${medal}${result.rank}位：${result.displayName} ${formatBbScore({ score: result.score, initialChips })} ${formatNumber(result.costShare)}円`;
  });

  return [
    `【${gameTitle}】`,
    `合計：${formatNumber(settlementTotal)}円（${results.length}人）`,
    "",
    ...resultLines,
    "",
    "※BBスコア＝（残チップ－リバイ数×初期チップ）÷1BB",
    `1BB＝${formatChipsPerBb(initialChips)}チップ（初期${formatNumber(initialChips)}チップ＝100BB）`,
  ].join("\n");
}

function formatNumber(value: number): string {
  return value.toLocaleString("ja-JP");
}
