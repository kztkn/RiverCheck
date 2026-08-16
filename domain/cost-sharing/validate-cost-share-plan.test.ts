import { describe, expect, it } from "vitest";
import { validateCostSharePlan } from "./validate-cost-share-plan";

describe("validateCostSharePlan", () => {
  it("全順位が100円単位・順位順・合計一致なら受理する", () => {
    expect(
      validateCostSharePlan({
        venueCost: 11_330,
        participantCount: 5,
        shares: [1_800, 2_000, 2_300, 2_500, 2_800],
      }),
    ).toEqual({
      settlementTotal: 11_400,
      shares: [1_800, 2_000, 2_300, 2_500, 2_800],
    });
  });

  it("最下位だけを変更して合計不足になった配分を拒否する", () => {
    expect(() =>
      validateCostSharePlan({
        venueCost: 11_330,
        participantCount: 5,
        shares: [1_800, 2_000, 2_300, 2_500, 2_500],
      }),
    ).toThrow("cost share total must match settlementTotal");
  });

  it("100円単位でない順位を拒否する", () => {
    expect(() =>
      validateCostSharePlan({
        venueCost: 11_330,
        participantCount: 5,
        shares: [1_850, 1_950, 2_300, 2_500, 2_800],
      }),
    ).toThrow("must be a multiple of 100");
  });

  it("順位傾斜が逆転した配分を拒否する", () => {
    expect(() =>
      validateCostSharePlan({
        venueCost: 11_330,
        participantCount: 5,
        shares: [1_800, 2_000, 2_300, 2_900, 2_400],
      }),
    ).toThrow("place costs must be non-decreasing");
  });

  it("人数と配分件数が一致しない場合を拒否する", () => {
    expect(() =>
      validateCostSharePlan({
        venueCost: 11_330,
        participantCount: 6,
        shares: [1_800, 2_000, 2_300, 2_500, 2_800],
      }),
    ).toThrow("cost share count must match participantCount");
  });

  it("4人未満を拒否する", () => {
    expect(() =>
      validateCostSharePlan({
        venueCost: 3_000,
        participantCount: 3,
        shares: [500, 1_000, 1_500],
      }),
    ).toThrow("participantCount must be at least 4");
  });
});
