import {
  calculatePlayerStatsRanking,
  rankPlayers,
} from "../player-stats/rank-players";
import type {
  PlayerStatsRankingSnapshots,
  PlayerStatsRankingRow,
  PlayerStatsSort,
} from "../../types/player-stats";
export interface Season {
  key: string;
  name: string;
  prefix: string;
  startAt: string;
  endAt: string;
  finalizeAt: string;
}
export function seasonFor(year: number, half = 1): Season {
  if (
    !Number.isInteger(year) ||
    year < 2026 ||
    year > 9998 ||
    ![1, 2].includes(half)
  )
    throw new Error("Invalid season");
  const first = year === 2026;
  const month = first ? 6 : half === 1 ? 1 : 7;
  const date = (y: number, m: number, d = 1) =>
    new Date(Date.UTC(y, m - 1, d) - 9 * 3600000).toISOString();
  return {
    key: first ? "2026" : `${year}-s${half}`,
    name: first ? "2026 FIRST SEASON" : `${year} S${half}`,
    prefix: first ? "2026" : `${year} S${half}`,
    startAt: date(year, month, first ? 19 : 1),
    endAt: date(
      first || half === 2 ? year + 1 : year,
      first || half === 2 ? 1 : 7,
    ),
    finalizeAt: date(year, first || half === 2 ? 12 : 6),
  };
}
export function availableSeasons(now = new Date()): Season[] {
  const year = Number(
    new Intl.DateTimeFormat("en", {
      year: "numeric",
      timeZone: "Asia/Tokyo",
    }).format(now),
  );
  const list = [seasonFor(2026)];
  for (let y = 2027; y <= year; y++)
    for (const h of [1, 2]) {
      const s = seasonFor(y, h);
      if (Date.parse(s.startAt) <= now.getTime()) list.push(s);
    }
  return list.reverse();
}
export function rankSeason(
  ranking: readonly PlayerStatsRankingRow[],
  sort: PlayerStatsSort,
) {
  const rows = rankPlayers(ranking, sort);
  if (sort !== "total") return rows;
  let rank = 0;
  return rows.map((row, i) => {
    if (!i || rows[i - 1].totalNetBb !== row.totalNetBb) rank = i + 1;
    return { ...row, rank };
  });
}
export function seasonRanking(
  snapshots: PlayerStatsRankingSnapshots,
): PlayerStatsRankingRow[] {
  const rows = calculatePlayerStatsRanking(snapshots, "total");
  const previous = rankSeason(
    calculatePlayerStatsRanking(
      { current: snapshots.previous, previous: [] },
      "total",
    ),
    "total",
  );
  return rankSeason(rows, "total").map((row) => ({
    ...row,
    previousRanks: {
      ...row.previousRanks,
      total:
        previous.find((p) => p.groupPlayerId === row.groupPlayerId)?.rank ??
        null,
    },
  }));
}
export function seasonAwards(season: Season, rank: number) {
  const awards = [
    {
      code: `season-${season.key}-player`,
      name: `${season.prefix} ${season.key === "2026" ? "はじまりの一席" : "プレイヤー"}`,
    },
  ];
  if (rank <= 3)
    awards.unshift({
      code: `season-${season.key}-rank-${rank}`,
      name: `${season.prefix} ${["卓上の王者", "準王者", "ブロンズ"][rank - 1]}`,
    });
  return awards;
}
