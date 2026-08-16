import { describe, expect, it } from "vitest";
import {
  evaluateAchievements,
  type AchievementGameResult,
} from "./evaluate-achievements";

function game(
  gameId: string,
  overrides: Partial<AchievementGameResult> = {},
): AchievementGameResult {
  return {
    gameId,
    rank: 2,
    participantCount: 4,
    netBb: 0,
    totalRebuyCount: 0,
    outstandingRebuyCount: 0,
    settlementRebuyCount: 0,
    ...overrides,
  };
}

function codes(games: AchievementGameResult[]): string[] {
  return evaluateAchievements(games).map((unlock) => unlock.code);
}

function source(
  games: AchievementGameResult[],
  code: string,
): string | undefined {
  return evaluateAchievements(games).find((unlock) => unlock.code === code)
    ?.sourceGameId;
}

describe("evaluateAchievements existing achievements", () => {
  it("records the first game that satisfies each existing condition", () => {
    const unlocks = evaluateAchievements([
      game("game-1", { rank: 1, netBb: 40 }),
      game("game-2", { rank: 1, netBb: 70 }),
      game("game-3", { rank: 1, netBb: 310 }),
      game("game-4", { rank: 4, netBb: -20 }),
      game("game-5", { rank: 2, netBb: 10 }),
    ]);

    expect(unlocks).toEqual(expect.arrayContaining([
      { code: "first-win", sourceGameId: "game-1" },
      { code: "hundred-bb", sourceGameId: "game-2" },
      { code: "three-wins", sourceGameId: "game-3" },
      { code: "big-winner", sourceGameId: "game-3" },
      { code: "five-games", sourceGameId: "game-5" },
    ]));
  });

});

describe("ファーストハンド", () => {
  it("unlocks at the first finalized participation", () => {
    expect(source([game("game-1")], "first-hand")).toBe("game-1");
  });

  it("does not unlock without a finalized participation", () => {
    expect(codes([])).not.toContain("first-hand");
  });

  it("does not treat an unfinalized registration as history", () => {
    const finalizedHistory: AchievementGameResult[] = [];
    expect(codes(finalizedHistory)).not.toContain("first-hand");
  });
});

describe("不死鳥", () => {
  it("unlocks with at least one rebuy and first place", () => {
    expect(codes([
      game("game-1", { rank: 1, totalRebuyCount: 1 }),
    ])).toContain("phoenix");
  });

  it("does not unlock for a no-rebuy winner", () => {
    expect(codes([game("game-1", { rank: 1 })])).not.toContain("phoenix");
  });

  it("does not unlock for second place after a rebuy", () => {
    expect(codes([
      game("game-1", { rank: 2, totalRebuyCount: 1 }),
    ])).not.toContain("phoenix");
  });
});

describe("生還", () => {
  it("unlocks for a positive result after a rebuy", () => {
    expect(codes([
      game("game-1", { totalRebuyCount: 1, netBb: 1 }),
    ])).toContain("survivor");
  });

  it.each([0, -1])("does not unlock when net BB is %s", (netBb) => {
    expect(codes([
      game("game-1", { totalRebuyCount: 1, netBb }),
    ])).not.toContain("survivor");
  });

  it("does not unlock without a rebuy", () => {
    expect(codes([
      game("game-1", { totalRebuyCount: 0, netBb: 100 }),
    ])).not.toContain("survivor");
  });
});

describe("借りたものは返す", () => {
  it("unlocks when all rebuy debt and certificates are cleared", () => {
    expect(codes([
      game("game-1", {
        totalRebuyCount: 1,
        outstandingRebuyCount: 0,
        settlementRebuyCount: 0,
      }),
    ])).toContain("paid-in-full");
  });

  it("does not unlock with tracked outstanding debt", () => {
    expect(codes([
      game("game-1", {
        totalRebuyCount: 1,
        outstandingRebuyCount: 1,
        settlementRebuyCount: 0,
      }),
    ])).not.toContain("paid-in-full");
  });

  it("does not unlock with a remaining certificate", () => {
    expect(codes([
      game("game-1", {
        totalRebuyCount: 1,
        outstandingRebuyCount: 0,
        settlementRebuyCount: 1,
      }),
    ])).not.toContain("paid-in-full");
  });

  it("does not unlock without a rebuy or with unknown legacy debt", () => {
    expect(codes([
      game("game-1"),
      game("game-2", {
        totalRebuyCount: 1,
        outstandingRebuyCount: null,
      }),
    ])).not.toContain("paid-in-full");
  });
});

describe("ノーダメージ", () => {
  it("unlocks after three no-rebuy participant games", () => {
    expect(source([
      game("game-1"),
      game("game-3"),
      game("game-7"),
    ], "no-damage")).toBe("game-7");
  });

  it("ignores group games the player did not participate in", () => {
    const participantHistory = [
      game("participant-game-1"),
      game("participant-game-4"),
      game("participant-game-8"),
    ];
    expect(codes(participantHistory)).toContain("no-damage");
  });

  it("does not unlock when one of the latest three games has a rebuy", () => {
    expect(codes([
      game("game-1"),
      game("game-2", { totalRebuyCount: 1 }),
      game("game-3"),
    ])).not.toContain("no-damage");
  });

  it("does not unlock with fewer than three participations", () => {
    expect(codes([game("game-1"), game("game-2")])).not.toContain(
      "no-damage",
    );
  });
});

describe("三日天下", () => {
  it("unlocks from first place to last place", () => {
    expect(codes([
      game("game-1", { rank: 1, participantCount: 5 }),
      game("game-4", { rank: 4, participantCount: 4 }),
    ])).toContain("three-day-reign");
  });

  it("uses consecutive participant games even when group games were missed", () => {
    expect(source([
      game("joined-1", { rank: 1 }),
      game("joined-9", { rank: 6, participantCount: 6 }),
    ], "three-day-reign")).toBe("joined-9");
  });

  it("does not unlock unless the previous participant game was first", () => {
    expect(codes([
      game("game-1", { rank: 2 }),
      game("game-2", { rank: 4 }),
    ])).not.toContain("three-day-reign");
  });

  it("does not unlock when the current result is not last", () => {
    expect(codes([
      game("game-1", { rank: 1 }),
      game("game-2", { rank: 3, participantCount: 4 }),
    ])).not.toContain("three-day-reign");
  });
});

describe("下剋上", () => {
  it("unlocks from last place to first place", () => {
    expect(codes([
      game("game-1", { rank: 5, participantCount: 5 }),
      game("game-2", { rank: 1, participantCount: 4 }),
    ])).toContain("giant-killer");
  });

  it("uses consecutive participant games across absences", () => {
    expect(source([
      game("joined-2", { rank: 4 }),
      game("joined-8", { rank: 1 }),
    ], "giant-killer")).toBe("joined-8");
  });

  it("does not unlock when the previous result was not last", () => {
    expect(codes([
      game("game-1", { rank: 3, participantCount: 4 }),
      game("game-2", { rank: 1 }),
    ])).not.toContain("giant-killer");
  });
});

describe("4位のプロ", () => {
  it("unlocks on the third fourth-place result", () => {
    expect(source([
      game("game-1", { rank: 4 }),
      game("game-2", { rank: 4 }),
      game("game-3", { rank: 4 }),
    ], "fourth-place-pro")).toBe("game-3");
  });

  it("does not unlock with only two fourth-place results", () => {
    expect(codes([
      game("game-1", { rank: 4 }),
      game("game-2", { rank: 4 }),
    ])).not.toContain("fourth-place-pro");
  });

  it("counts non-consecutive fourth-place results", () => {
    expect(codes([
      game("game-1", { rank: 4 }),
      game("game-2", { rank: 1 }),
      game("game-3", { rank: 4 }),
      game("game-4", { rank: 2 }),
      game("game-5", { rank: 4 }),
    ])).toContain("fourth-place-pro");
  });

  it("does not count an impossible fourth place in a sub-four-player game", () => {
    expect(codes([
      game("game-1", { rank: 4, participantCount: 3 }),
      game("game-2", { rank: 4 }),
      game("game-3", { rank: 4 }),
    ])).not.toContain("fourth-place-pro");
  });
});

describe("銀メダル収集家", () => {
  it("unlocks on the third second-place result", () => {
    expect(source([
      game("game-1", { rank: 2 }),
      game("game-2", { rank: 2 }),
      game("game-3", { rank: 2 }),
    ], "silver-collector")).toBe("game-3");
  });

  it("does not unlock with only two second-place results", () => {
    expect(codes([
      game("game-1", { rank: 2 }),
      game("game-2", { rank: 2 }),
    ])).not.toContain("silver-collector");
  });

  it("counts non-consecutive second-place results", () => {
    expect(codes([
      game("game-1", { rank: 2 }),
      game("game-2", { rank: 4 }),
      game("game-3", { rank: 2 }),
      game("game-4", { rank: 1 }),
      game("game-5", { rank: 2 }),
    ])).toContain("silver-collector");
  });
});

describe("王座防衛", () => {
  it("unlocks for two consecutive participant wins without the retired BtB code", () => {
    const unlocks = evaluateAchievements([
      game("game-1", { rank: 1 }),
      game("game-2", { rank: 1 }),
    ]);

    expect(unlocks).toContainEqual({
      code: "title-defense",
      sourceGameId: "game-2",
    });
    expect(unlocks.map((unlock) => unlock.code)).not.toContain("back-to-back");
  });

  it("ignores absent group games between participant wins", () => {
    expect(codes([
      game("joined-1", { rank: 1 }),
      game("joined-5", { rank: 1 }),
    ])).toContain("title-defense");
  });

  it("does not unlock when the previous participant result was second", () => {
    expect(codes([
      game("game-1", { rank: 2 }),
      game("game-2", { rank: 1 }),
    ])).not.toContain("title-defense");
  });
});

describe("achievement evaluation reconciliation", () => {
  it("unlocks multiple achievements from the same game without duplicates", () => {
    const unlocks = evaluateAchievements([
      game("game-1", {
        rank: 1,
        netBb: 120,
        totalRebuyCount: 1,
        outstandingRebuyCount: 0,
        settlementRebuyCount: 0,
      }),
    ]);
    const gameUnlockCodes = unlocks.map((unlock) => unlock.code);

    expect(gameUnlockCodes).toEqual(expect.arrayContaining([
      "first-hand",
      "first-win",
      "phoenix",
      "survivor",
      "paid-in-full",
      "hundred-bb",
    ]));
    expect(new Set(gameUnlockCodes).size).toBe(gameUnlockCodes.length);
  });

  it("removes a condition from the evaluated set after a correction", () => {
    const beforeCorrection = codes([
      game("game-1", { rank: 1, totalRebuyCount: 1 }),
    ]);
    const afterCorrection = codes([
      game("game-1", { rank: 2, totalRebuyCount: 1 }),
    ]);

    expect(beforeCorrection).toContain("phoenix");
    expect(afterCorrection).not.toContain("phoenix");
  });

  it("adds newly satisfied achievements after a correction", () => {
    const beforeCorrection = codes([
      game("game-1", { rank: 4 }),
      game("game-2", { rank: 2 }),
    ]);
    const afterCorrection = codes([
      game("game-1", { rank: 4 }),
      game("game-2", { rank: 1 }),
    ]);

    expect(beforeCorrection).not.toContain("giant-killer");
    expect(afterCorrection).toContain("giant-killer");
  });
});
