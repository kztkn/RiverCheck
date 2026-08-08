import { Link } from "react-router";
import { getGroupOverview } from "@server/services/group-service.server";
import type { Route } from "./+types/group-top";

const statusLabels = {
  draft: "準備中",
  open: "受付中",
  finalized: "確定済み",
} as const;

export async function loader({ params }: Route.LoaderArgs) {
  const overview = await getGroupOverview(params.groupCode);
  if (!overview) throw new Response("Group not found", { status: 404 });
  return overview;
}

export default function GroupTop({ loaderData }: Route.ComponentProps) {
  const { group, games } = loaderData;

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

      <section className="hero-card">
        <div>
          <p className="eyebrow">YOUR POKER TABLE</p>
          <h1>{group.name}</h1>
          <p className="hero-copy">
            チップも会場費も、最後のリバーまで迷わない。
            開催を作って、みんなの結果をひとつにまとめます。
          </p>
        </div>
        <Link className="button button-primary" to="manage">
          主催者画面を開く
        </Link>
      </section>

      <section className="content-section" aria-labelledby="games-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">GAMES</p>
            <h2 id="games-heading">開催一覧</h2>
          </div>
          <span className="count-badge">{games.length}件</span>
        </div>

        {games.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon" aria-hidden="true">
              ♠
            </div>
            <h3>まだ開催はありません</h3>
            <p>最初のポーカー会を作成すると、ここに表示されます。</p>
          </div>
        ) : (
          <div className="game-list">
            {games.map((game) => (
              <article className="game-card" key={game.id}>
                <Link className="game-card-main" to={`games/${game.id}`}>
                  <span className={`status status-${game.status}`}>
                    {statusLabels[game.status]}
                  </span>
                  <h3>{game.title}</h3>
                  <time dateTime={game.playedAt}>
                    {new Intl.DateTimeFormat("ja-JP", {
                      dateStyle: "long",
                      timeZone: "Asia/Tokyo",
                    }).format(new Date(game.playedAt))}
                  </time>
                </Link>
                <div className="game-card-actions">
                  <Link className="card-action" to={`games/${game.id}`}>
                    参加ページ
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

      <footer className="site-footer">
        <span>RIVER CHECK</span>
        <span>Play fair. Settle clean.</span>
      </footer>
    </main>
  );
}
