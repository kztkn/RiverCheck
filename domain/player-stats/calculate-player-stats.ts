export interface PlayerStatsGameInput {
  gameId: string;
  rank: number;
  netBb: number;
}

export interface PlayerStatsAggregate {
  gamesPlayed: number;
  wins: number;
  winRate: number;
  averageRank: number;
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
      winRate: 0,
      averageRank: 0,
      totalNetBb: 0,
      averageNetBb: 0,
      maxWinBb: 0,
      maxLossBb: 0,
    };
  }

  const wins = games.filter((game) => game.rank === 1).length;
  const totalNetBb = games.reduce((total, game) => total + game.netBb, 0);
  const totalRank = games.reduce((total, game) => total + game.rank, 0);

  return {
    gamesPlayed: games.length,
    wins,
    winRate: (wins * 100) / games.length,
    averageRank: totalRank / games.length,
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
