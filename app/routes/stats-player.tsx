import { Link } from "react-router";
import { PlayerPerformanceChart } from "~/components/player-performance-chart";
import { formatSignedBbValue } from "@domain/score/bb-score";
import { getPlayerStatsDetail } from "@server/services/player-stats-service.server";
import type { Route } from "./+types/stats-player";

export async function loader({ params }: Route.LoaderArgs) {
  const overview = await getPlayerStatsDetail(
    params.groupCode,
    params.groupPlayerId,
  );
  if (!overview) throw new Response("Player not found", { status: 404 });
  return overview;
}

export default function StatsPlayer({ loaderData }: Route.ComponentProps) {
  const { group, playerStats } = loaderData;
  const { summary, games } = playerStats;
  const recentGames = [...games].reverse();

  return (
    <main className="page-shell stats-page">
      <header className="site-header">
        <Link className="brand" to={`/g/${group.publicCode}`}>
          <span className="brand-mark">RC</span>
          <span>RiverCheck</span>
        </Link>
        <Link className="text-link" to={`/g/${group.publicCode}/stats`}>
          ← ランキング
        </Link>
      </header>

      <section className="stats-intro stats-player-intro">
        <p className="eyebrow">PLAYER PROFILE</p>
        <h1>{summary.displayName}</h1>
        <p>{group.name}での確定済み戦績</p>
      </section>

      <section className="stats-kpi-grid" aria-label="戦績サマリー">
        <Kpi label="参加回数" value={`${summary.gamesPlayed}回`} />
        <Kpi label="優勝回数" value={`${summary.wins}回`} />
        <Kpi label="優勝率" value={formatPercent(summary.winRate)} />
        <Kpi
          label="平均順位"
          value={summary.gamesPlayed === 0 ? "—" : `${formatDecimal(summary.averageRank)}位`}
        />
        <Kpi label="累計損益" tone={getBbToneClass(summary.totalNetBb)} value={formatSignedBbValue(summary.totalNetBb)} />
        <Kpi label="平均損益" tone={getBbToneClass(summary.averageNetBb)} value={formatSignedBbValue(summary.averageNetBb)} />
        <Kpi label="最大勝ち" tone={getBbToneClass(summary.maxWinBb)} value={formatSignedBbValue(summary.maxWinBb)} />
        <Kpi label="最大負け" tone={getBbToneClass(summary.maxLossBb)} value={formatSignedBbValue(summary.maxLossBb)} />
      </section>

      <section className="stats-panel" aria-labelledby="chart-heading">
        <div className="section-heading compact-heading">
          <div>
            <p className="eyebrow">PERFORMANCE</p>
            <h2 id="chart-heading">累計損益BB推移</h2>
          </div>
        </div>
        {games.length === 0 ? (
          <div className="mini-empty"><p>確定済みの戦績がまだありません。</p></div>
        ) : (
          <PlayerPerformanceChart games={games} />
        )}
      </section>

      <section className="content-section stats-history" aria-labelledby="history-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">GAME HISTORY</p>
            <h2 id="history-heading">開催別結果</h2>
          </div>
          <span className="count-badge">{games.length}戦</span>
        </div>

        {recentGames.length === 0 ? (
          <div className="mini-empty"><p>参加した開催が確定すると、ここに追加されます。</p></div>
        ) : (
          <div className="stats-game-list">
            {recentGames.map((game) => (
              <Link
                className="stats-game-card"
                key={game.gameId}
                to={`/g/${group.publicCode}/games/${game.gameId}`}
              >
                <span className="stats-game-date">{formatGameDate(game.playedAt)}</span>
                <span className="stats-game-title">
                  <strong>{game.gameTitle}</strong>
                  <small>{game.rank}位・リバイ {game.rebuyCount}回</small>
                </span>
                <strong className={getBbToneClass(game.netBb)}>
                  {formatSignedBbValue(game.netBb)}
                </strong>
                <span className="card-arrow" aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function Kpi({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return <div className="stats-kpi-card"><span>{label}</span><strong className={tone}>{value}</strong></div>;
}

function formatPercent(value: number): string {
  return `${formatDecimal(value)}%`;
}

function formatDecimal(value: number): string {
  return value.toLocaleString("ja-JP", { maximumFractionDigits: 1 });
}

function formatGameDate(isoDate: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "short",
    day: "numeric",
    timeZone: "Asia/Tokyo",
  }).format(new Date(isoDate));
}

function getBbToneClass(value: number): string {
  return value > 0 ? "bb-positive" : value < 0 ? "bb-negative" : "bb-neutral";
}
