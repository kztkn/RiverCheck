import { describe, expect, it } from "vitest";
import {
  recommendTopCosts,
  recommendTopCostsForAttendance,
} from "./recommend-top-costs";

describe("recommendTopCosts", () => {
  it("4人の負担を順位ウェイトでなだらかにする", () => {
    expect(recommendTopCosts(11_330, 4)).toEqual({
      firstPlaceCost: 1_100,
      secondPlaceCost: 2_200,
      thirdPlaceCost: 3_400,
      settlementTotal: 11_400,
      shares: [1_100, 2_200, 3_400, 4_700],
    });
  });

  it("8人でも100円単位かつ単調増加の配分を返す", () => {
    const result = recommendTopCosts(11_330, 8);

    expect(result).toMatchObject({
      firstPlaceCost: 300,
      secondPlaceCost: 600,
      thirdPlaceCost: 900,
      settlementTotal: 11_400,
    });
    expect(
      result.shares.every(
        (share, index) => index === 0 || share >= result.shares[index - 1]!,
      ),
    ).toBe(true);
    expect(result.shares.reduce((sum, share) => sum + share, 0)).toBe(11_400);
  });

  it("4人未満を拒否する", () => {
    expect(() => recommendTopCosts(11_330, 3)).toThrow(RangeError);
  });

  it("実参加人数が想定人数を超えた場合は実参加人数へ合わせる", () => {
    expect(recommendTopCostsForAttendance(11_330, 4, 6)).toMatchObject({
      participantCount: 6,
      adjustedToAttendance: true,
      firstPlaceCost: 500,
      secondPlaceCost: 1_000,
      thirdPlaceCost: 1_600,
    });
  });

  it("想定人数が実参加人数以上なら想定人数を維持する", () => {
    expect(recommendTopCostsForAttendance(11_330, 8, 6)).toMatchObject({
      participantCount: 8,
      adjustedToAttendance: false,
    });
  });
});
