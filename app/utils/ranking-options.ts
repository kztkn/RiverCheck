import type { PlayerStatsSort } from "@shared-types/player-stats";

export const RANKING_OPTIONS: ReadonlyArray<{
  value: PlayerStatsSort;
  label: string;
}> = [
  { value: "total", label: "累計BB" },
  { value: "average", label: "平均BB" },
  { value: "recent", label: "直近3戦" },
  { value: "top-three", label: "TOP3回数" },
  { value: "rank-rate", label: "順位率" },
  { value: "max-win", label: "最大勝ち" },
  { value: "max-loss", label: "最大負け" },
];
