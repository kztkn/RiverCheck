import { GroupSiteHeader } from "~/components/site-menu";
import {
  IconPlus,
  IconSettings,
  IconUsers,
} from "@tabler/icons-react";
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
      <GroupSiteHeader groupCode={group.publicCode} organizer />

      <section className="hero-card organizer-hero">
        <div>
          <h1>ORGANIZER HOME</h1>
          <p className="hero-copy">
            {group.name} の開催作成、参加状況、結果をここから管理します。
          </p>
        </div>
        <div className="hero-actions">
          <Link
            className="button button-secondary organizer-nav-button"
            to={`/g/${group.publicCode}/players`}
          >
            <IconUsers aria-hidden="true" stroke={1.8} />
            メンバー管理
          </Link>
          <Link
            className="button button-secondary organizer-nav-button"
            to={`/g/${group.publicCode}/settings`}
          >
            <IconSettings aria-hidden="true" stroke={1.8} />
            グループ設定
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
          <div className="section-heading-actions">
            <span className="count-badge">{games.length}件</span>
            <Link
              className="button button-primary button-small"
              to={`/g/${group.publicCode}/games/new`}
            >
              <IconPlus aria-hidden="true" stroke={2} />
              新しい会
            </Link>
          </div>
        </div>

        {games.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon" aria-hidden="true">
              ♠
            </div>
            <h3>まだ開催はありません</h3>
            <p>「新しい会」から最初の開催を作ってください。</p>
          </div>
        ) : (
          <div className="game-list">
            {games.map((game) => (
              <article className="game-card" key={game.id}>
                <Link
                  className="game-card-main"
                  to={
                    game.status === "finalized"
                      ? `/g/${group.publicCode}/games/${game.id}/admin/edit`
                      : `/g/${group.publicCode}/games/${game.id}/admin`
                  }
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
                    className="card-action"
                    to={
                      game.status === "finalized"
                        ? `/g/${group.publicCode}/games/${game.id}/admin/edit`
                        : `/g/${group.publicCode}/games/${game.id}/admin`
                    }
                  >
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
