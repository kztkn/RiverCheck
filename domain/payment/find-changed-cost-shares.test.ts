import { describe, expect, it } from "vitest";
import { findChangedCostSharePlayerIds } from "./find-changed-cost-shares";

describe("findChangedCostSharePlayerIds", () => {
  it("訂正で会費が変わった参加者だけを返す", () => {
    expect(
      findChangedCostSharePlayerIds(
        [
          { groupPlayerId: "a", costShare: 0 },
          { groupPlayerId: "b", costShare: 500 },
          { groupPlayerId: "c", costShare: 1_000 },
        ],
        [
          { groupPlayerId: "a", costShare: 0 },
          { groupPlayerId: "b", costShare: 1_000 },
          { groupPlayerId: "c", costShare: 500 },
        ],
      ),
    ).toEqual(["b", "c"]);
  });

  it("順位が変わっても会費が同じなら返さない", () => {
    expect(
      findChangedCostSharePlayerIds(
        [
          { groupPlayerId: "a", costShare: 500 },
          { groupPlayerId: "b", costShare: 500 },
        ],
        [
          { groupPlayerId: "b", costShare: 500 },
          { groupPlayerId: "a", costShare: 500 },
        ],
      ),
    ).toEqual([]);
  });
});
