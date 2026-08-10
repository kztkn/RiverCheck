import { describe, expect, it } from "vitest";
import { calculateScore } from "./calculate-score";

describe("calculateScore", () => {
  it("残チップからリバイ分を控除する", () => {
    expect(
      calculateScore({
        remainingChips: 67_700,
        settlementRebuyCount: 2,
        rebuyChips: 10_000,
      }),
    ).toBe(47_700);
  });

  it("負の入力を拒否する", () => {
    expect(() =>
      calculateScore({
        remainingChips: -1,
        settlementRebuyCount: 0,
        rebuyChips: 10_000,
      }),
    ).toThrow(RangeError);
  });
});
