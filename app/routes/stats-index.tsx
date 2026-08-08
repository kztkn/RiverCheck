import { GroupSiteHeader } from "~/components/site-menu";
import { Link } from "react-router";
import { PlayerAvatar } from "~/components/player-avatar";
import { buildPlayerAvatarUrl } from "@domain/player-profile/build-player-avatar-url";
import { formatSignedBbValue } from "@domain/score/bb-score";
import {
  getPlayerStatsRanking,
  parsePlayerStatsSort,
} from "@server/services/player-stats-service.server";
import type { Route } from "./+types/stats-index";

export async function loader({ request, params }: Route.LoaderArgs) {
  const sort = parsePlayerStatsSort(new URL(request.url).searchParams.get("sort"));
  const overview = await getPlayerStatsRanking(params.groupCode, sort);
  if (!overview) throw new Response("Group not found", { status: 404 });
  return overview;
}

export default function StatsIndex({ loaderData }: Route.ComponentProps) {
  const { group, ranking, sort } = loaderData;

  return (
    <main className="page-shell stats-page">
      <GroupSiteHeader groupCode={group.publicCode} />

      <section className="stats-intro">
        <p className="eyebrow">PLAYER STATS</p>
        <h1>ランキング</h1>
      </section>

      <section className="content-section" aria-labelledby="ranking-heading">
        <div className="section-heading stats-heading">
          <div>
            <p className="eyebrow">RANKING</p>
            <h2 id="ranking-heading">ランキング</h2>
          </div>
          <div className="stats-sort" aria-label="ランキングの並び順">
            <Link
              aria-current={sort === "total" ? "page" : undefined}
              className={sort === "total" ? "is-active" : undefined}
              to="?sort=total"
            >
              累計
            </Link>
            <Link
              aria-current={sort === "average" ? "page" : undefined}
              className={sort === "average" ? "is-active" : undefined}
              to="?sort=average"
            >
              平均
            </Link>
          </div>
        </div>

        {ranking.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon" aria-hidden="true">♠</div>
            <h3>まだメンバーがいません</h3>
            <p>参加者が登録されると、ここに戦績が表示されます。</p>
          </div>
        ) : (
          <div className="stats-ranking-list">
            {ranking.map((player) => {
              const primaryValue =
                sort === "average" ? player.averageNetBb : player.totalNetBb;
              return (
                <Link
                  className="stats-ranking-card"
                  key={player.groupPlayerId}
                  to={player.groupPlayerId}
                >
                  <span className="stats-rank">{player.rank}</span>
                  <span className="stats-player-identity">
                    <PlayerAvatar
                      avatarUrl={buildPlayerAvatarUrl({
                        avatarUpdatedAt: player.avatarUpdatedAt,
                        groupCode: group.publicCode,
                        groupPlayerId: player.groupPlayerId,
                      })}
                      displayName={player.displayName}
                    />
                    <span className="stats-player-name">
                      <strong>{player.displayName}</strong>
                      <small>{player.gamesPlayed}回参加・1位 {player.wins}回</small>
                    </span>
                  </span>
                  <span className="stats-primary-value">
                    <small>{sort === "average" ? "平均損益" : "累計損益"}</small>
                    <strong className={getBbToneClass(primaryValue)}>
                      {formatSignedBbValue(primaryValue)}
                    </strong>
                  </span>
                  <span className="stats-secondary-value">
                    <small>
                      {sort === "average" ? "累計" : "平均"}{" "}
                      {formatSignedBbValue(
                        sort === "average" ? player.totalNetBb : player.averageNetBb,
                      )}
                    </small>
                  </span>
                  <span className="card-arrow" aria-hidden="true">→</span>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

function getBbToneClass(value: number): string {
  return value > 0 ? "bb-positive" : value < 0 ? "bb-negative" : "bb-neutral";
}
