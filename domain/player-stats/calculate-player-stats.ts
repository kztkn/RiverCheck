export interface PlayerStatsGameInput {
  gameId: string;
  rank: number;
  netBb: number;
}

export interface PlayerStatsAggregate {
  gamesPlayed: number;
  wins: number;
  topThreeFinishes: number;
  topThreeRate: number;
  positiveFinishes: number;
  positiveRate: number;
  totalNetBb: number;
  averageNetBb: number;
  maxWinBb: number;
  maxLossBb: number;
}

export interface CumulativePlayerStatsGame extends PlayerStatsGameInput {
  cumulativeNetBb: number;
}

export function calculatePlayerStats(
  games: PlayerStatsGameInput[],
): PlayerStatsAggregate {
  if (games.length === 0) {
    return {
      gamesPlayed: 0,
      wins: 0,
      topThreeFinishes: 0,
      topThreeRate: 0,
      positiveFinishes: 0,
      positiveRate: 0,
      totalNetBb: 0,
      averageNetBb: 0,
      maxWinBb: 0,
      maxLossBb: 0,
    };
  }

  const wins = games.filter((game) => game.rank === 1).length;
  const topThreeFinishes = games.filter((game) => game.rank <= 3).length;
  const positiveFinishes = games.filter((game) => game.netBb > 0).length;
  const totalNetBb = games.reduce((total, game) => total + game.netBb, 0);

  return {
    gamesPlayed: games.length,
    wins,
    topThreeFinishes,
    topThreeRate: (topThreeFinishes * 100) / games.length,
    positiveFinishes,
    positiveRate: (positiveFinishes * 100) / games.length,
    totalNetBb,
    averageNetBb: totalNetBb / games.length,
    maxWinBb: Math.max(...games.map((game) => game.netBb), 0),
    maxLossBb: Math.min(...games.map((game) => game.netBb), 0),
  };
}

export function addCumulativeNetBb(
  gamesInChronologicalOrder: PlayerStatsGameInput[],
): CumulativePlayerStatsGame[] {
  let cumulativeNetBb = 0;
  return gamesInChronologicalOrder.map((game) => {
    cumulativeNetBb += game.netBb;
    return { ...game, cumulativeNetBb };
  });
}
