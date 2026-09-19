import { Link } from "react-router";
import { formatSignedBbValue } from "@domain/score/bb-score";
import type { PlayerGameStat } from "@shared-types/player-stats";

export function summarizeRecentThreeGames(games: PlayerGameStat[]) {
  const items = [...games].reverse().slice(0, 3);
  return {
    items,
    totalNetBb: items.reduce((total, game) => total + game.netBb, 0),
  };
}

export function PlayerRecentThree({
  games,
  groupCode,
}: {
  games: PlayerGameStat[];
  groupCode: string;
}) {
  const { items, totalNetBb } = summarizeRecentThreeGames(games);
  if (items.length === 0) return null;

  return (
    <section
      aria-labelledby="recent-three-heading"
      className="stats-recent-three"
    >
      <div className="stats-recent-three-lead">
        <p className="stats-brand-label">RECENT FORM</p>
        <div>
          <h2 id="recent-three-heading">直近3戦</h2>
          <strong className={bbTone(totalNetBb)}>
            {formatSignedBbValue(totalNetBb)}
          </strong>
        </div>
        <small>最新{items.length}戦の合計損益</small>
      </div>

      <div className="stats-recent-three-games">
        {items.map((game) => (
          <Link
            className="stats-recent-three-game"
            key={game.gameId}
            to={`/g/${groupCode}/games/${game.gameId}`}
          >
            <span className="stats-recent-three-game-copy">
              <small>{formatRecentDate(game.playedAt)}</small>
              <strong>{game.gameTitle}</strong>
              <span>{formatRank(game.rank)}</span>
            </span>
            <b className={bbTone(game.netBb)}>
              {formatSignedBbValue(game.netBb)}
            </b>
            <span aria-hidden="true" className="stats-recent-three-arrow">
              →
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function bbTone(value: number): string {
  return value > 0 ? "bb-positive" : value < 0 ? "bb-negative" : "bb-neutral";
}

function formatRecentDate(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));
}

function formatRank(rank: number): string {
  if (rank === 1) return "1st";
  if (rank === 2) return "2nd";
  if (rank === 3) return "3rd";
  return `${rank}th`;
}
