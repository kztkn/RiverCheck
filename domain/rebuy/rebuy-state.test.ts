import { describe, expect, it } from "vitest";
import { applyRebuyDelta, transitionRebuyState } from "./rebuy-state";

describe("rebuy state", () => {
  it("リバイで累計と未返済を1ずつ増やす", () => {
    expect(
      transitionRebuyState(
        { totalRebuyCount: 1, outstandingRebuyCount: 0 },
        "rebuy",
      ),
    ).toEqual({ totalRebuyCount: 2, outstandingRebuyCount: 1 });
  });

  it("100BB返済では累計を変えず未返済だけ減らす", () => {
    expect(
      transitionRebuyState(
        { totalRebuyCount: 2, outstandingRebuyCount: 1 },
        "repayment",
      ),
    ).toEqual({ totalRebuyCount: 2, outstandingRebuyCount: 0 });
  });

  it("未返済0口からの返済を拒否する", () => {
    expect(() =>
      transitionRebuyState(
        { totalRebuyCount: 2, outstandingRebuyCount: 0 },
        "repayment",
      ),
    ).toThrow(RangeError);
  });

  it("イベントの逆差分で直前のリバイをUndoできる", () => {
    expect(
      applyRebuyDelta(
        { totalRebuyCount: 2, outstandingRebuyCount: 1 },
        { totalDelta: -1, outstandingDelta: -1 },
      ),
    ).toEqual({ totalRebuyCount: 1, outstandingRebuyCount: 0 });
  });

  it("未返済が累計を超える状態を拒否する", () => {
    expect(() =>
      applyRebuyDelta(
        { totalRebuyCount: 1, outstandingRebuyCount: 1 },
        { totalDelta: -1, outstandingDelta: 0 },
      ),
    ).toThrow(RangeError);
  });
});
