export interface LineResultEntry {
  displayName: string;
  score: number;
  rank: number;
  costShare: number;
}

export function formatLineResult(
  gameTitle: string,
  results: LineResultEntry[],
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
    return `${medal}${result.rank}位：${result.displayName} ${formatNumber(result.score)}点 ${formatNumber(result.costShare)}円`;
  });

  return [
    `【${gameTitle}】`,
    `合計：${formatNumber(settlementTotal)}円（${results.length}人）`,
    "",
    ...resultLines,
    "",
    "※点数＝残チップ－（リバイ数×リバイチップ）",
  ].join("\n");
}

function formatNumber(value: number): string {
  return value.toLocaleString("ja-JP");
}
