import { describe, expect, it } from "vitest";
import { recommendTopCosts } from "./recommend-top-costs";
import { validateCostSharePlan } from "./validate-cost-share-plan";

describe("2〜3人開催の精算", () => {
  it("2人の標準配分を生成して検証できる", () => {
    const result = recommendTopCosts(3_000, 2, "standard");
    expect(result.shares).toHaveLength(2);
    expect(result.shares[0]).toBeLessThanOrEqual(result.shares[1]!);
    expect(validateCostSharePlan({ venueCost: 3_000, participantCount: 2, shares: result.shares }).shares).toEqual(result.shares);
  });

  it("3人のゆる傾斜を生成して検証できる", () => {
    const result = recommendTopCosts(4_500, 3, "gentle");
    expect(result.shares).toHaveLength(3);
    expect(result.shares.reduce((sum, share) => sum + share, 0)).toBe(4_500);
    expect(result.shares.every((share, index) => index === 0 || share >= result.shares[index - 1]!)).toBe(true);
  });

  it("1人開催は拒否する", () => {
    expect(() => recommendTopCosts(1_000, 1)).toThrow(RangeError);
  });
});
