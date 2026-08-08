import { describe, expect, it } from "vitest";
import { validateChipTotal } from "./validate-chip-total";

describe("validateChipTotal", () => {
  it("初期チップとリバイを含めた総量が一致する", () => {
    expect(
      validateChipTotal({
        initialChips: 20_000,
        rebuyChips: 10_000,
        reports: [
          { remainingChips: 35_000, rebuyCount: 1 },
          { remainingChips: 15_000, rebuyCount: 0 },
        ],
      }),
    ).toEqual({
      expectedTotal: 50_000,
      reportedTotal: 50_000,
      difference: 0,
      isValid: true,
    });
  });

  it("不足分をdifferenceで返す", () => {
    expect(
      validateChipTotal({
        initialChips: 20_000,
        rebuyChips: 10_000,
        reports: [
          { remainingChips: 30_000, rebuyCount: 1 },
          { remainingChips: 15_000, rebuyCount: 0 },
        ],
      }),
    ).toMatchObject({ difference: 5_000, isValid: false });
  });
});
