import { formatOrdinal } from "@domain/ranking/format-ordinal";

export function RankingPosition({ rank, previousRank }: {
  rank: number;
  previousRank: number | null;
}) {
  const change = previousRank === null ? null : previousRank - rank;
  const label = change === null
    ? ""
    : change === 0
      ? "前回比：順位変動なし"
      : `前回${previousRank}位から${Math.abs(change)}位${change > 0 ? "上昇" : "下降"}`;

  return (
    <span className="stats-rank">
      <span>{formatOrdinal(rank)}</span>
      {change === null ? null : (
        <small className="stats-rank-change" aria-label={label} title={label}>
          {change === 0 ? "—" : `${change > 0 ? "↑" : "↓"}${Math.abs(change)}`}
        </small>
      )}
    </span>
  );
}
