import { Link } from "react-router";
import { formatOrdinal } from "@domain/ranking/format-ordinal";
import { formatSignedBbValue } from "@domain/score/bb-score";
import type {
  PlayerGameStat,
  PlayerStatsSummary,
} from "@shared-types/player-stats";

export function PlayerStatsOverview({
  summary,
}: {
  summary: PlayerStatsSummary;
}) {
  return (
    <section
      aria-labelledby="performance-summary-heading"
      className="player-performance-summary"
    >
      <header className="stats-summary-heading">
        <p className="stats-brand-label">PERFORMANCE</p>
        <h2 id="performance-summary-heading">戦績サマリー</h2>
      </header>

      <div className="stats-profit-lead">
        <span>TOTAL PROFIT</span>
        <strong className={getBbToneClass(summary.totalNetBb)}>
          {formatSignedBbValue(summary.totalNetBb)}
        </strong>
      </div>

      <dl className="stats-core-metrics">
        <Stat label="参加回数" value={`${summary.gamesPlayed}回`} />
        <Stat label="優勝回数" value={`${summary.wins}回`} />
        <Stat label="優勝率" value={formatPercent(summary.winRate)} />
        <Stat
          label="平均順位"
          value={
            summary.gamesPlayed === 0
              ? "—"
              : formatDecimal(summary.averageRank)
          }
        />
      </dl>

      <dl className="stats-detail-metrics">
        <Stat
          label="平均損益"
          tone={getBbToneClass(summary.averageNetBb)}
          value={formatSignedBbValue(summary.averageNetBb)}
        />
        <Stat
          label="最大勝ち"
          tone={getBbToneClass(summary.maxWinBb)}
          value={formatSignedBbValue(summary.maxWinBb)}
        />
        <Stat
          label="最大負け"
          tone={getBbToneClass(summary.maxLossBb)}
          value={formatSignedBbValue(summary.maxLossBb)}
        />
      </dl>
    </section>
  );
}

export function PlayerGameHistory({
  games,
  groupCode,
}: {
  games: PlayerGameStat[];
  groupCode: string;
}) {
  return (
    <section
      aria-labelledby="history-heading"
      className="content-section stats-history"
    >
      <div className="section-heading stats-section-heading">
        <h2 id="history-heading">開催履歴</h2>
        <span className="count-badge">{games.length}戦</span>
      </div>

      {games.length === 0 ? (
        <div className="mini-empty">
          <p>参加した開催が確定すると、ここに追加されます。</p>
        </div>
      ) : (
        <ol className="stats-game-list">
          {games.map((game) => (
            <li key={game.gameId}>
              <Link
                className="stats-game-row"
                to={`/g/${groupCode}/games/${game.gameId}`}
              >
                <time
                  className="stats-game-date"
                  dateTime={game.playedAt}
                >
                  {formatGameDate(game.playedAt)}
                </time>
                <span
                  className={`stats-game-rank${game.rank === 1 ? " is-winner" : ""}`}
                >
                  {formatOrdinal(game.rank)}
                </span>
                <span className="stats-game-title">
                  <strong>{game.gameTitle}</strong>
                  <small>{formatRebuySummary(game)}</small>
                </span>
                <strong className={getBbToneClass(game.netBb)}>
                  {formatSignedBbValue(game.netBb)}
                </strong>
                <span aria-hidden="true" className="stats-game-arrow">→</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Stat({
  label,
  tone = "",
  value,
}: {
  label: string;
  tone?: string;
  value: string;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className={tone}>{value}</dd>
    </div>
  );
}

function formatRebuySummary(game: PlayerGameStat): string {
  return game.totalRebuyCount === null
    ? `Rebuy不明・終了時未返済 ${game.settlementRebuyCount}口`
    : `Rebuy ${game.totalRebuyCount}回・終了時未返済 ${game.settlementRebuyCount}口`;
}

function formatPercent(value: number): string {
  return `${formatDecimal(value)}%`;
}

function formatDecimal(value: number): string {
  return value.toLocaleString("ja-JP", { maximumFractionDigits: 1 });
}

function formatGameDate(isoDate: string): string {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    day: "2-digit",
    month: "numeric",
    timeZone: "Asia/Tokyo",
  }).formatToParts(new Date(isoDate));
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  return `${month}.${day}`;
}

function getBbToneClass(value: number): string {
  return value > 0 ? "bb-positive" : value < 0 ? "bb-negative" : "bb-neutral";
}
