import { describe, expect, it } from "vitest";
import { evaluateAchievements } from "./evaluate-achievements";

describe("evaluateAchievements", () => {
  it("records the first game that satisfies each cumulative condition", () => {
    const unlocks = evaluateAchievements([
      { gameId: "game-1", rank: 1, netBb: 40 },
      { gameId: "game-2", rank: 1, netBb: 70 },
      { gameId: "game-3", rank: 1, netBb: 310 },
      { gameId: "game-4", rank: 4, netBb: -20 },
      { gameId: "game-5", rank: 2, netBb: 10 },
    ]);

    expect(unlocks).toEqual(expect.arrayContaining([
      { code: "first-win", sourceGameId: "game-1" },
      { code: "back-to-back", sourceGameId: "game-2" },
      { code: "hundred-bb", sourceGameId: "game-2" },
      { code: "three-wins", sourceGameId: "game-3" },
      { code: "big-winner", sourceGameId: "game-3" },
      { code: "five-games", sourceGameId: "game-5" },
    ]));
  });

  it("does not treat non-consecutive wins as back to back", () => {
    const unlocks = evaluateAchievements([
      { gameId: "game-1", rank: 1, netBb: 0 },
      { gameId: "game-2", rank: 2, netBb: 0 },
      { gameId: "game-3", rank: 1, netBb: 0 },
    ]);

    expect(unlocks.some((item) => item.code === "back-to-back")).toBe(false);
  });
});
