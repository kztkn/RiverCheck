export type EvaluatedAchievementCode =
  | "first-win"
  | "back-to-back"
  | "three-wins"
  | "five-games"
  | "ten-games"
  | "big-winner"
  | "hundred-bb";

export interface AchievementGameResult {
  gameId: string;
  rank: number;
  netBb: number;
}

export interface AchievementUnlock {
  code: EvaluatedAchievementCode;
  sourceGameId: string;
}

export function evaluateAchievements(
  games: AchievementGameResult[],
): AchievementUnlock[] {
  const unlocks: AchievementUnlock[] = [];
  let wins = 0;
  let cumulativeNetBb = 0;

  for (let index = 0; index < games.length; index += 1) {
    const game = games[index];
    if (!game) continue;

    if (index === 4) {
      unlocks.push({ code: "five-games", sourceGameId: game.gameId });
    }
    if (index === 9) {
      unlocks.push({ code: "ten-games", sourceGameId: game.gameId });
    }

    if (game.rank === 1) {
      wins += 1;
      if (wins === 1) {
        unlocks.push({ code: "first-win", sourceGameId: game.gameId });
      }
      if (wins === 3) {
        unlocks.push({ code: "three-wins", sourceGameId: game.gameId });
      }
      if (index > 0 && games[index - 1]?.rank === 1) {
        unlocks.push({ code: "back-to-back", sourceGameId: game.gameId });
      }
    }

    if (game.netBb >= 300 && !unlocks.some((item) => item.code === "big-winner")) {
      unlocks.push({ code: "big-winner", sourceGameId: game.gameId });
    }

    cumulativeNetBb += game.netBb;
    if (
      cumulativeNetBb >= 100 &&
      !unlocks.some((item) => item.code === "hundred-bb")
    ) {
      unlocks.push({ code: "hundred-bb", sourceGameId: game.gameId });
    }
  }

  return unlocks;
}
