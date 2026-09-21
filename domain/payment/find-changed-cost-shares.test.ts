import { describe, expect, it } from "vitest";
import {
  findChangedCostSharePlayerIds,
  findChangedSettlementPlayerIds,
} from "./find-changed-cost-shares";

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

describe("findChangedSettlementPlayerIds", () => {
  it("会費が同じでもゲーム精算による最終残高変更を返す", () => {
    expect(
      findChangedSettlementPlayerIds(
        [{ groupPlayerId: "a", costShare: 500, gameSettlementAmount: 0 }],
        [{ groupPlayerId: "a", costShare: 500, gameSettlementAmount: 1_000 }],
      ),
    ).toEqual(["a"]);
  });

  it("内訳が変わっても最終残高が同じなら返さない", () => {
    expect(
      findChangedSettlementPlayerIds(
        [{ groupPlayerId: "a", costShare: 500, gameSettlementAmount: 0 }],
        [{ groupPlayerId: "a", costShare: 1_000, gameSettlementAmount: 500 }],
      ),
    ).toEqual([]);
  });
});
