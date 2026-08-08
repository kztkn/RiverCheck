import { describe, expect, it } from "vitest";
import { calculateRanking } from "./calculate-ranking";

describe("calculateRanking", () => {
  it("score降順、rebuyCount昇順で順位を付ける", () => {
    const result = calculateRanking([
      { groupPlayerId: "c", score: 10_000, rebuyCount: 2 },
      { groupPlayerId: "a", score: 20_000, rebuyCount: 1 },
      { groupPlayerId: "b", score: 10_000, rebuyCount: 1 },
    ]);

    expect(result.map(({ groupPlayerId, rank }) => ({ groupPlayerId, rank }))).toEqual([
      { groupPlayerId: "a", rank: 1 },
      { groupPlayerId: "b", rank: 2 },
      { groupPlayerId: "c", rank: 3 },
    ]);
  });

  it("完全同点はgroupPlayerId昇順で決定する", () => {
    const result = calculateRanking([
      { groupPlayerId: "b", score: 10_000, rebuyCount: 1 },
      { groupPlayerId: "a", score: 10_000, rebuyCount: 1 },
    ]);

    expect(result.map((entry) => entry.groupPlayerId)).toEqual(["a", "b"]);
  });
});
