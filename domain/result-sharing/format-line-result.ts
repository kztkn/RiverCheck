import { formatNetBb } from "../score/bb-score";

export interface LineResultEntry {
  displayName: string;
  score: number;
  rank: number;
  costShare: number;
  gameSettlementAmount?: number;
}

export function formatLineResult(
  gameTitle: string,
  results: LineResultEntry[],
  initialChips: number,
  bbRate = 0,
  initialStackBb = 100,
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
    if (bbRate === 0) {
      return `${medal}${result.rank}位：${result.displayName} ${formatNetBb({ score: result.score, initialChips, initialStackBb })} ${formatNumber(result.costShare)}円`;
    }
    const gameAmount = result.gameSettlementAmount ?? 0;
    const balance = gameAmount - result.costShare;
    return `${medal}${result.rank}位：${result.displayName} ${formatNetBb({ score: result.score, initialChips, initialStackBb })} 最終 ${formatSignedYen(balance)}（ゲーム ${formatSignedYen(gameAmount)} / 会費 -${formatNumber(result.costShare)}円）`;
  });

  return [
    `【${gameTitle}】`,
    bbRate === 0
      ? `合計：${formatNumber(settlementTotal)}円（${results.length}人）`
      : `会費合計：${formatNumber(settlementTotal)}円（${results.length}人） / 1BB = ${formatNumber(bbRate)}円`,
    "",
    ...resultLines,
  ].join("\n");
}

function formatSignedYen(value: number): string {
  return `${value > 0 ? "+" : ""}${formatNumber(value)}円`;
}

function formatNumber(value: number): string {
  return value.toLocaleString("ja-JP");
}
