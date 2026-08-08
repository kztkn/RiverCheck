import { Link } from "react-router";
import { getGroupOverview } from "@server/services/group-service.server";
import type { GameListItem } from "@shared-types/game";
import type { Route } from "./+types/group-top";

const statusLabels = {
  draft: "準備中",
  open: "受付中",
  finalized: "終了",
} as const;

export async function loader({ params }: Route.LoaderArgs) {
  const overview = await getGroupOverview(params.groupCode);
  if (!overview) throw new Response("Group not found", { status: 404 });
  return overview;
}

export default function GroupTop({ loaderData }: Route.ComponentProps) {
  const { group, games } = loaderData;
  const activeGames = games.filter((game) => game.status !== "finalized");
  const pastGames = games.filter((game) => game.status === "finalized");

  return (
    <main className="page-shell">
      <header className="site-header">
        <Link className="brand" to={`/g/${group.publicCode}`}>
          <span className="brand-mark">RC</span>
          <span>RiverCheck</span>
        </Link>
        <Link className="text-link" to="manage">
          主催者画面
        </Link>
      </header>

      <section className="hero-card group-hero-card">
        <div>
          <p className="eyebrow">YOUR POKER TABLE</p>
          <h1>{group.name}</h1>
          <p className="hero-copy">
            チップも会費も、最後のリバーまで迷わない。
            みんなの結果をひとつにまとめます。
          </p>
        </div>
      </section>

      <Link className="stats-cta" to="stats">
        <span>
          <small>PLAYER STATS</small>
          <strong>個人戦績を見る</strong>
        </span>
        <span aria-hidden="true">→</span>
      </Link>

      <GameSection
        eyebrow="OPEN GAMES"
        emptyMessage="現在受付中の開催はありません。"
        games={activeGames}
        heading="受付中"
      />

      <GameSection
        eyebrow="HISTORY"
        emptyMessage="過去の開催はまだありません。"
        games={pastGames}
        heading="過去の開催"
        isPast
      />

      <footer className="site-footer">
        <span>RIVER CHECK</span>
        <span>Play fair. Settle clean.</span>
      </footer>
    </main>
  );
}

function GameSection({
  eyebrow,
  emptyMessage,
  games,
  heading,
  isPast = false,
}: {
  eyebrow: string;
  emptyMessage: string;
  games: GameListItem[];
  heading: string;
  isPast?: boolean;
}) {
  const headingId = isPast ? "past-games-heading" : "active-games-heading";

  return (
    <section
      className={`content-section game-history-section${isPast ? " is-past" : ""}`}
      aria-labelledby={headingId}
    >
      <div className="section-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2 id={headingId}>{heading}</h2>
        </div>
        <span className="count-badge">{games.length}件</span>
      </div>

      {games.length === 0 ? (
        <div className="game-history-empty">
          <p>{emptyMessage}</p>
        </div>
      ) : (
        <div className="game-list">
          {games.map((game) => (
            <article className="game-card" key={game.id}>
              <Link className="game-card-main" to={`games/${game.id}`}>
                {!isPast ? (
                  <span className={`status status-${game.status}`}>
                    {statusLabels[game.status]}
                  </span>
                ) : null}
                <h3>{game.title}</h3>
                <time dateTime={game.playedAt}>
                  {formatGameDate(game.playedAt)}
                </time>
                {isPast ? (
                  <span className="game-card-summary">
                    <span>参加 {game.participantCount}人</span>
                    <span>優勝 {game.winnerName ?? "—"}</span>
                  </span>
                ) : null}
              </Link>
              <div className="game-card-actions">
                <Link className="card-action" to={`games/${game.id}`}>
                  {isPast ? "結果を見る" : "参加ページ"}
                  <span className="card-arrow" aria-hidden="true">
                    →
                  </span>
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function formatGameDate(playedAt: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "long",
    timeZone: "Asia/Tokyo",
  }).format(new Date(playedAt));
}
