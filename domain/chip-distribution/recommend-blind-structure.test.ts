import { describe, expect, it } from "vitest";
import { recommendBlindStructureFromInventory } from "./recommend-blind-structure";

describe("recommendBlindStructureFromInventory", () => {
  const currentEightPlayerInventory = [
    { denomination: 5_000, count: 16 },
    { denomination: 1_000, count: 40 },
    { denomination: 500, count: 64 },
    { denomination: 100, count: 80 },
  ];

  it("実績のある20,000・25枚構成を8人分の在庫から再現する", () => {
    const result = recommendBlindStructureFromInventory(
      currentEightPlayerInventory,
      8,
    );

    expect(result).toEqual({
      ok: true,
      recommendation: expect.objectContaining({
        participantCount: 8,
        initialChips: 20_000,
        initialStackBb: 100,
        smallBlindChips: 100,
        bigBlindChips: 200,
        bigBlindAnteChips: 200,
        allocations: [
          { denomination: 100, count: 10 },
          { denomination: 500, count: 8 },
          { denomination: 1_000, count: 5 },
          { denomination: 5_000, count: 2 },
        ],
        totalChipCount: 25,
        totalRequiredChipCount: 200,
      }),
    });
    if (!result.ok) throw new Error(result.error);
    expect(result.recommendation.inventoryUsage).toEqual([
      {
        denomination: 100,
        availableCount: 80,
        perPlayerCount: 10,
        requiredCount: 80,
        remainingCount: 0,
      },
      {
        denomination: 500,
        availableCount: 64,
        perPlayerCount: 8,
        requiredCount: 64,
        remainingCount: 0,
      },
      {
        denomination: 1_000,
        availableCount: 40,
        perPlayerCount: 5,
        requiredCount: 40,
        remainingCount: 0,
      },
      {
        denomination: 5_000,
        availableCount: 16,
        perPlayerCount: 2,
        requiredCount: 16,
        remainingCount: 0,
      },
    ]);
  });

  it("余っている別額面があっても配りやすい構成を優先する", () => {
    const result = recommendBlindStructureFromInventory(
      [
        { denomination: 10_000, count: 8 },
        { denomination: 5_000, count: 16 },
        { denomination: 1_000, count: 40 },
        { denomination: 500, count: 64 },
        { denomination: 100, count: 80 },
        { denomination: 50, count: 80 },
      ],
      8,
    );

    expect(result).toMatchObject({
      ok: true,
      recommendation: {
        initialChips: 20_000,
        smallBlindChips: 100,
        bigBlindChips: 200,
        totalChipCount: 25,
      },
    });
  });

  it("同じ在庫でも人数が多く全員分を配れなければ明示エラーにする", () => {
    expect(
      recommendBlindStructureFromInventory(currentEightPlayerInventory, 10),
    ).toMatchObject({
      ok: false,
      code: "no-practical-configuration",
    });
  });

  it.each([
    [1, "invalid-participant-count"],
    [21, "invalid-participant-count"],
  ] as const)("参加人数 %s を拒否する", (participantCount, code) => {
    expect(
      recommendBlindStructureFromInventory(
        currentEightPlayerInventory,
        participantCount,
      ),
    ).toMatchObject({ ok: false, code });
  });

  it("重複額面と不正な枚数を拒否する", () => {
    expect(
      recommendBlindStructureFromInventory(
        [
          { denomination: 100, count: 80 },
          { denomination: 100, count: 20 },
          { denomination: 500, count: 40 },
        ],
        8,
      ),
    ).toMatchObject({ ok: false, code: "duplicate-denomination" });

    expect(
      recommendBlindStructureFromInventory(
        [
          { denomination: 100, count: -1 },
          { denomination: 500, count: 40 },
          { denomination: 1_000, count: 40 },
        ],
        8,
      ),
    ).toMatchObject({ ok: false, code: "invalid-chip-count" });
  });
});
