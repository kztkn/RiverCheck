export type EvaluatedAchievementCode =
  | "first-win"
  | "three-wins"
  | "five-games"
  | "ten-games"
  | "big-winner"
  | "hundred-bb"
  | "first-hand"
  | "phoenix"
  | "survivor"
  | "paid-in-full"
  | "no-damage"
  | "three-day-reign"
  | "giant-killer"
  | "fourth-place-pro"
  | "silver-collector"
  | "title-defense";

export const evaluatedAchievementCodes = [
  "first-win",
  "three-wins",
  "five-games",
  "ten-games",
  "big-winner",
  "hundred-bb",
  "first-hand",
  "phoenix",
  "survivor",
  "paid-in-full",
  "no-damage",
  "three-day-reign",
  "giant-killer",
  "fourth-place-pro",
  "silver-collector",
  "title-defense",
] as const satisfies readonly EvaluatedAchievementCode[];

export interface AchievementGameResult {
  gameId: string;
  rank: number;
  participantCount: number;
  netBb: number;
  totalRebuyCount: number;
  outstandingRebuyCount: number | null;
  settlementRebuyCount: number;
}

export interface AchievementUnlock {
  code: EvaluatedAchievementCode;
  sourceGameId: string;
}

export function evaluateAchievements(
  games: AchievementGameResult[],
): AchievementUnlock[] {
  const unlocks: AchievementUnlock[] = [];
  const unlockedCodes = new Set<EvaluatedAchievementCode>();
  let wins = 0;
  let fourthPlaces = 0;
  let secondPlaces = 0;
  let cumulativeNetBb = 0;

  const unlock = (
    code: EvaluatedAchievementCode,
    sourceGameId: string,
  ): void => {
    if (unlockedCodes.has(code)) return;
    unlockedCodes.add(code);
    unlocks.push({ code, sourceGameId });
  };

  for (let index = 0; index < games.length; index += 1) {
    const game = games[index];
    if (!game) continue;
    const previousGame = games[index - 1];

    if (index === 0) unlock("first-hand", game.gameId);
    if (index === 4) unlock("five-games", game.gameId);
    if (index === 9) unlock("ten-games", game.gameId);

    if (game.rank === 1) {
      wins += 1;
      if (wins === 1) unlock("first-win", game.gameId);
      if (wins === 3) unlock("three-wins", game.gameId);
      if (previousGame?.rank === 1) {
        unlock("title-defense", game.gameId);
      }
      if (previousGame && isLastPlace(previousGame)) {
        unlock("giant-killer", game.gameId);
      }
      if (game.totalRebuyCount >= 1) {
        unlock("phoenix", game.gameId);
      }
    }

    if (
      previousGame?.rank === 1 &&
      isLastPlace(game)
    ) {
      unlock("three-day-reign", game.gameId);
    }

    if (game.participantCount >= 4 && game.rank === 4) {
      fourthPlaces += 1;
      if (fourthPlaces === 3) {
        unlock("fourth-place-pro", game.gameId);
      }
    }

    if (game.rank === 2) {
      secondPlaces += 1;
      if (secondPlaces === 3) {
        unlock("silver-collector", game.gameId);
      }
    }

    if (game.totalRebuyCount >= 1 && game.netBb > 0) {
      unlock("survivor", game.gameId);
    }

    if (
      game.totalRebuyCount >= 1 &&
      game.outstandingRebuyCount === 0 &&
      game.settlementRebuyCount === 0
    ) {
      unlock("paid-in-full", game.gameId);
    }

    if (
      index >= 2 &&
      games
        .slice(index - 2, index + 1)
        .every((historyGame) => historyGame.totalRebuyCount === 0)
    ) {
      unlock("no-damage", game.gameId);
    }

    if (game.netBb >= 300) {
      unlock("big-winner", game.gameId);
    }

    cumulativeNetBb += game.netBb;
    if (cumulativeNetBb >= 100) {
      unlock("hundred-bb", game.gameId);
    }
  }

  return unlocks;
}

function isLastPlace(game: AchievementGameResult): boolean {
  return game.participantCount > 0 && game.rank === game.participantCount;
}
