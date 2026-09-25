import type { PlayerStatsSort } from "@shared-types/player-stats";

export const PRIMARY_RANKING_OPTIONS: ReadonlyArray<{
  value: PlayerStatsSort;
  label: string;
}> = [
  { value: "total", label: "累計BB" },
  { value: "recent", label: "直近3戦" },
  { value: "top-three", label: "TOP3" },
];

export const SECONDARY_RANKING_OPTIONS: ReadonlyArray<{
  value: PlayerStatsSort;
  label: string;
}> = [
  { value: "average", label: "平均BB" },
  { value: "rank-rate", label: "順位率" },
  { value: "max-win", label: "最大勝ち" },
  { value: "max-loss", label: "最大負け" },
];

export function isSecondaryRankingSort(sort: PlayerStatsSort): boolean {
  return SECONDARY_RANKING_OPTIONS.some((option) => option.value === sort);
}
