import { describe, expect, it } from "vitest";
import { RANKING_OPTIONS } from "./ranking-options";

describe("ranking options", () => {
  it("keeps all seven metrics in one horizontal selector", () => {
    expect(RANKING_OPTIONS).toEqual([
      { value: "total", label: "累計BB" },
      { value: "average", label: "平均BB" },
      { value: "recent", label: "直近3戦" },
      { value: "top-three", label: "TOP3回数" },
      { value: "rank-rate", label: "順位率" },
      { value: "max-win", label: "最大勝ち" },
      { value: "max-loss", label: "最大負け" },
    ]);
  });
});
