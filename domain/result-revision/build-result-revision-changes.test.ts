import { describe, expect, it } from "vitest";
import {
  buildResultRevisionChanges,
  hasResultInputChanges,
  type RevisionResult,
} from "./build-result-revision-changes";

function result(
  groupPlayerId: string,
  overrides: Partial<RevisionResult> = {},
): RevisionResult {
  return {
    groupPlayerId,
    displayName: groupPlayerId.toUpperCase(),
    remainingChips: 20_000,
    rebuyCount: 0,
    score: 20_000,
    rank: 1,
    costShare: 0,
    ...overrides,
  };
}

describe("buildResultRevisionChanges", () => {
  it("入力または確定結果が変わった参加者だけを返す", () => {
    const before = [
      result("a"),
      result("b", { rank: 2, costShare: 500 }),
      result("c", { rank: 3, costShare: 1_000 }),
    ];
    const after = [
      result("a", { remainingChips: 10_000, score: 10_000, rank: 2, costShare: 500 }),
      result("b", { rank: 1, costShare: 0 }),
      result("c", { rank: 3, costShare: 1_000 }),
    ];

    expect(buildResultRevisionChanges(before, after)).toEqual([
      {
        groupPlayerId: "a",
        displayName: "A",
        before: before[0],
        after: after[0],
      },
      {
        groupPlayerId: "b",
        displayName: "B",
        before: before[1],
        after: after[1],
      },
    ]);
  });

  it("順位や負担額が現在ロジックと違っても入力が同じなら変更扱いにしない", () => {
    const before = [
      result("a", { rank: 2, costShare: 2_552 }),
      result("b", { rank: 1, costShare: 2_700 }),
    ];

    expect(
      hasResultInputChanges(
        before,
        before.map(({ groupPlayerId, remainingChips, rebuyCount }) => ({
          groupPlayerId,
          remainingChips,
          rebuyCount,
        })),
      ),
    ).toBe(false);
  });

  it("残りチップまたはリバイの変更を検出する", () => {
    expect(
      hasResultInputChanges([result("a")], [
        { groupPlayerId: "a", remainingChips: 19_000, rebuyCount: 0 },
      ]),
    ).toBe(true);
  });
});
