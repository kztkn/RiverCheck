import { GroupSiteHeader } from "~/components/site-menu";
import { Link } from "react-router";
import { PlayerAvatar } from "~/components/player-avatar";
import { AchievementBadge } from "~/components/achievement-badge";
import { buildPlayerAvatarUrl } from "@domain/player-profile/build-player-avatar-url";
import { formatSignedBbValue } from "@domain/score/bb-score";
import { formatOrdinal } from "@domain/ranking/format-ordinal";
import {
  getPlayerStatsRanking,
  parsePlayerStatsSort,
} from "@server/services/player-stats-service.server";
import type { Route } from "./+types/stats-index";
import type {
  PlayerStatsRankingRow,
  PlayerStatsSort,
} from "@shared-types/player-stats";

const rankingOptions: Array<{ value: PlayerStatsSort; label: string }> = [
  { value: "total", label: "累計" },
  { value: "average", label: "平均" },
  { value: "max-win", label: "最大勝ち" },
  { value: "max-loss", label: "最大負け" },
  { value: "recent", label: "最近" },
  { value: "top-three", label: "TOP3" },
  { value: "rank-rate", label: "平均順位率" },
];

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
        <h1>RANKING</h1>
      </section>
      <section className="content-section" aria-labelledby="ranking-heading">
        <div className="section-heading stats-heading">
          <div className="stats-sort" aria-label="ランキングの並び順">
            {rankingOptions.map((option) => (
              <Link
                aria-current={sort === option.value ? "page" : undefined}
                className={sort === option.value ? "is-active" : undefined}
                key={option.value}
                to={`?sort=${option.value}`}
              >
                {option.label}
              </Link>
            ))}
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
              const metric = getRankingMetric(player, sort);
              return (
                <Link
                  className="stats-ranking-card"
                  key={player.groupPlayerId}
                  to={player.groupPlayerId}
                >
                  <span className="stats-rank">{formatOrdinal(player.rank)}</span>
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
                      {player.equippedAchievement ? (
                        <AchievementBadge
                          achievement={player.equippedAchievement}
                          compact
                        />
                      ) : null}
                      <small>{player.gamesPlayed}回参加・優勝{player.wins}回</small>
                    </span>
                  </span>
                  <span className="stats-primary-value">
                    <small>{metric.label}</small>
                    <strong className={metric.tone}>
                      {metric.value}
                    </strong>
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

function getRankingMetric(
  player: PlayerStatsRankingRow,
  sort: PlayerStatsSort,
): { label: string; value: string; tone: string } {
  if (sort === "top-three") {
    return {
      label: "TOP3入り",
      value: `${player.topThreeFinishes}回`,
      tone: "",
    };
  }
  if (sort === "rank-rate") {
    return {
      label: "平均順位率（低いほど上位）",
      value: player.averageRankRate === null
        ? "—"
        : `${formatDecimal(player.averageRankRate)}%`,
      tone: "",
    };
  }

  const bbMetric = sort === "average"
    ? { label: "平均損益", value: player.averageNetBb }
    : sort === "max-win"
      ? { label: "最大勝ち", value: player.maxWinBb }
      : sort === "max-loss"
        ? { label: "最大負け", value: player.maxLossBb }
        : sort === "recent"
          ? {
              label: player.recentGameCount === 0
                ? "直近3戦平均"
                : `直近${player.recentGameCount}戦平均`,
              value: player.recentAverageNetBb,
            }
          : { label: "累計損益", value: player.totalNetBb };

  return {
    label: bbMetric.label,
    value: player.gamesPlayed === 0
      ? "—"
      : formatSignedBbValue(bbMetric.value),
    tone: player.gamesPlayed === 0 ? "" : getBbToneClass(bbMetric.value),
  };
}

function formatDecimal(value: number): string {
  return value.toLocaleString("ja-JP", { maximumFractionDigits: 1 });
}

function getBbToneClass(value: number): string {
  return value > 0 ? "bb-positive" : value < 0 ? "bb-negative" : "bb-neutral";
}
