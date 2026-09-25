import { describe, expect, it } from "vitest";
import {
  PRIMARY_RANKING_OPTIONS,
  SECONDARY_RANKING_OPTIONS,
  isSecondaryRankingSort,
} from "./ranking-options";

describe("ranking options", () => {
  it("keeps the three everyday metrics in the primary row", () => {
    expect(PRIMARY_RANKING_OPTIONS).toEqual([
      { value: "total", label: "累計BB" },
      { value: "recent", label: "直近3戦" },
      { value: "top-three", label: "TOP3" },
    ]);
  });

  it("moves detailed metrics behind the secondary controls", () => {
    expect(SECONDARY_RANKING_OPTIONS.map((option) => option.value)).toEqual([
      "average",
      "rank-rate",
      "max-win",
      "max-loss",
    ]);
    expect(isSecondaryRankingSort("average")).toBe(true);
    expect(isSecondaryRankingSort("total")).toBe(false);
  });
});
