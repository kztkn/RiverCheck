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
  | "title-defense"
  | "seven-deuce-first"
  | "seven-deuce-three"
  | "seven-deuce-five"
  | "all-in-five-wins"
  | "all-in-five-losses"
  | "rebuy-ten"
  | "rebuy-triple"
  | "story-first"
  | "story-three"
  | "story-five"
  | "love-giver"
  | "rollercoaster";

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
  "seven-deuce-first",
  "seven-deuce-three",
  "seven-deuce-five",
  "all-in-five-wins",
  "all-in-five-losses",
  "rebuy-ten",
  "rebuy-triple",
  "story-first",
  "story-three",
  "story-five",
  "love-giver",
  "rollercoaster",
] as const satisfies readonly EvaluatedAchievementCode[];

export interface AchievementGameResult {
  gameId: string;
  rank: number;
  participantCount: number;
  netBb: number;
  totalRebuyCount: number;
  outstandingRebuyCount: number | null;
  settlementRebuyCount: number;
  sevenDeuceCount: number;
  allInWinCount: number;
  allInLossCount: number;
  storyPostCount: number;
}

export interface AchievementActivitySummary {
  reactedStoryPostCount: number;
  fifthReactedStoryGameId: string | null;
}

export interface AchievementUnlock {
  code: EvaluatedAchievementCode;
  sourceGameId: string;
}

const emptyActivitySummary: AchievementActivitySummary = {
  reactedStoryPostCount: 0,
  fifthReactedStoryGameId: null,
};

export function evaluateAchievements(
  games: AchievementGameResult[],
  activity: AchievementActivitySummary = emptyActivitySummary,
): AchievementUnlock[] {
  const unlocks: AchievementUnlock[] = [];
  const unlockedCodes = new Set<EvaluatedAchievementCode>();
  let wins = 0;
  let fourthPlaces = 0;
  let secondPlaces = 0;
  let cumulativeNetBb = 0;
  let cumulativeRebuys = 0;
  let cumulativeSevenDeuce = 0;
  let cumulativeAllInWins = 0;
  let cumulativeAllInLosses = 0;
  let cumulativeStoryPosts = 0;
  let hasBigPositive = false;
  let hasBigNegative = false;

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

    if (previousGame?.rank === 1 && isLastPlace(game)) {
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

    cumulativeRebuys += game.totalRebuyCount;
    if (game.totalRebuyCount >= 3) {
      unlock("rebuy-triple", game.gameId);
    }
    if (cumulativeRebuys >= 10) {
      unlock("rebuy-ten", game.gameId);
    }

    cumulativeSevenDeuce += game.sevenDeuceCount;
    if (cumulativeSevenDeuce >= 1) {
      unlock("seven-deuce-first", game.gameId);
    }
    if (cumulativeSevenDeuce >= 3) {
      unlock("seven-deuce-three", game.gameId);
    }
    if (cumulativeSevenDeuce >= 5) {
      unlock("seven-deuce-five", game.gameId);
    }

    cumulativeAllInWins += game.allInWinCount;
    cumulativeAllInLosses += game.allInLossCount;
    if (cumulativeAllInWins >= 5) {
      unlock("all-in-five-wins", game.gameId);
    }
    if (cumulativeAllInLosses >= 5) {
      unlock("all-in-five-losses", game.gameId);
    }

    cumulativeStoryPosts += game.storyPostCount;
    if (cumulativeStoryPosts >= 1) {
      unlock("story-first", game.gameId);
    }
    if (cumulativeStoryPosts >= 3) {
      unlock("story-three", game.gameId);
    }
    if (cumulativeStoryPosts >= 5) {
      unlock("story-five", game.gameId);
    }

    hasBigPositive ||= game.netBb >= 200;
    hasBigNegative ||= game.netBb <= -200;
    if (hasBigPositive && hasBigNegative) {
      unlock("rollercoaster", game.gameId);
    }
  }

  if (
    activity.reactedStoryPostCount >= 5 &&
    activity.fifthReactedStoryGameId
  ) {
    unlock("love-giver", activity.fifthReactedStoryGameId);
  }

  return unlocks;
}

function isLastPlace(game: AchievementGameResult): boolean {
  return game.participantCount > 0 && game.rank === game.participantCount;
}
