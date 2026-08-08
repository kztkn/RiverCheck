import { Link } from "react-router";
import { getGroupOverview } from "@server/services/group-service.server";
import { requireOrganizer } from "@server/services/organizer-auth.server";
import type { Route } from "./+types/group-manage";

const statusLabels = {
  draft: "準備中",
  open: "受付中",
  finalized: "確定済み",
} as const;

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireOrganizer(request, params.groupCode);
  const overview = await getGroupOverview(params.groupCode);
  if (!overview) throw new Response("Group not found", { status: 404 });
  return overview;
}

export default function GroupManage({ loaderData }: Route.ComponentProps) {
  const { group, games } = loaderData;

  return (
    <main className="page-shell">
      <header className="site-header">
        <Link className="brand" to={`/g/${group.publicCode}/manage`}>
          <span className="brand-mark">RC</span>
          <span>RiverCheck</span>
        </Link>
        <div className="header-actions">
          <Link className="text-link" to={`/g/${group.publicCode}`}>
            参加者向け画面
          </Link>
          <form
            action={`/g/${group.publicCode}/organizer-login`}
            method="post"
          >
            <input name="intent" type="hidden" value="logout" />
            <button className="text-button" type="submit">
              ログアウト
            </button>
          </form>
        </div>
      </header>

      <section className="hero-card organizer-hero">
        <div>
          <p className="eyebrow">ORGANIZER HOME</p>
          <h1>主催者画面</h1>
          <p className="hero-copy">
            {group.name} の開催作成、参加状況、結果をここから管理します。
          </p>
        </div>
        <div className="hero-actions">
          <Link
            className="button button-secondary"
            to={`/g/${group.publicCode}/players`}
          >
            メンバー管理
          </Link>
          <Link
            className="button button-primary"
            to={`/g/${group.publicCode}/games/new`}
          >
            <span aria-hidden="true">＋</span>
            新しい会を作成
          </Link>
        </div>
      </section>

      <section
        className="content-section"
        aria-labelledby="manage-games-heading"
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">MANAGE GAMES</p>
            <h2 id="manage-games-heading">開催管理</h2>
          </div>
          <span className="count-badge">{games.length}件</span>
        </div>

        {games.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon" aria-hidden="true">
              ♠
            </div>
            <h3>まだ開催はありません</h3>
            <p>「新しい会を作成」から最初の開催を作ってください。</p>
          </div>
        ) : (
          <div className="game-list">
            {games.map((game) => (
              <article className="game-card" key={game.id}>
                <Link
                  className="game-card-main"
                  to={`/g/${group.publicCode}/games/${game.id}/admin`}
                >
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
                  <Link
                    className="button button-small button-secondary"
                    to={`/g/${group.publicCode}/games/${game.id}`}
                  >
                    参加ページ
                  </Link>
                  <Link
                    className="card-action"
                    to={`/g/${group.publicCode}/games/${game.id}/admin`}
                  >
                    管理する
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
    </main>
  );
}
