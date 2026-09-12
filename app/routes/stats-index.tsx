import { useMemo, useState } from "react";
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
  { value: "total", label: "累計損益" },
  { value: "average", label: "平均損益" },
  { value: "max-win", label: "最大勝ち" },
  { value: "max-loss", label: "最大負け" },
  { value: "recent", label: "直近3戦" },
  { value: "top-three", label: "TOP3回数" },
  { value: "rank-rate", label: "順位率" },
];

export async function loader({ request, params }: Route.LoaderArgs) {
  const sort = parsePlayerStatsSort(new URL(request.url).searchParams.get("sort"));
  const overview = await getPlayerStatsRanking(params.groupCode, sort);
  if (!overview) throw new Response("Group not found", { status: 404 });
  return overview;
}

export default function StatsIndex({ loaderData }: Route.ComponentProps) {
  const { group, ranking, sort } = loaderData;
  const [activeSort, setActiveSort] = useState<PlayerStatsSort>(sort);
  const visibleRanking = useMemo(
    () => rankPlayers(ranking, activeSort),
    [ranking, activeSort],
  );

  function handleSortChange(nextSort: PlayerStatsSort) {
    setActiveSort(nextSort);

    const url = new URL(window.location.href);
    url.searchParams.set("sort", nextSort);
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }

  return (
    <main className="page-shell stats-page">
      <GroupSiteHeader groupCode={group.publicCode} />
      <section className="stats-intro stats-ranking-intro">
        <p className="stats-brand-label">TABLE RANKING</p>
        <h1>RANKING</h1>
        <p>{group.name} のプレイヤーを、好きな指標で比べる。</p>
      </section>
      <section className="stats-ranking-section" aria-label="ランキング">
        <div className="section-heading stats-heading">
          <div className="stats-sort" aria-label="ランキングの並び順">
            {rankingOptions.map((option) => (
              <button
                aria-current={activeSort === option.value ? "page" : undefined}
                className={activeSort === option.value ? "is-active" : undefined}
                key={option.value}
                onClick={() => handleSortChange(option.value)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {visibleRanking.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon" aria-hidden="true">♠</div>
            <h3>まだメンバーがいません</h3>
            <p>参加者が登録されると、ここに戦績が表示されます。</p>
          </div>
        ) : (
          <div className="stats-ranking-list">
            {visibleRanking.map((player) => {
              const metric = getRankingMetric(player, activeSort);
              return (
                <Link
                  className={`stats-ranking-card${
                    player.rank <= 3 ? " is-top-three" : ""
                  }`}
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
                      <small>
                        参加 {player.gamesPlayed}回 ・ 優勝 {player.wins}回
                        {player.averageRankRate === null
                          ? ""
                          : ` ・ 順位率 ${formatDecimal(player.averageRankRate)}%`}
                      </small>
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

function rankPlayers(
  ranking: PlayerStatsRankingRow[],
  sort: PlayerStatsSort,
): PlayerStatsRankingRow[] {
  const sorted = [...ranking].sort((left, right) => {
    const metricOrder = compareRankingMetrics(left, right, sort);
    return metricOrder !== 0
      ? metricOrder
      : left.displayName.localeCompare(right.displayName, "ja");
  });

  let previousRank = 0;
  return sorted.map((player, index) => {
    const previous = sorted[index - 1];
    const rank =
      previous && compareRankingMetrics(previous, player, sort) === 0
        ? previousRank
        : index + 1;
    previousRank = rank;
    return { ...player, rank };
  });
}

function compareRankingMetrics(
  left: PlayerStatsRankingRow,
  right: PlayerStatsRankingRow,
  sort: PlayerStatsSort,
): number {
  if (sort === "average") {
    return compareDesc(left.averageNetBb, right.averageNetBb) ||
      compareDesc(left.totalNetBb, right.totalNetBb);
  }
  if (sort === "max-win") {
    return compareDesc(left.maxWinBb, right.maxWinBb) ||
      compareDesc(left.totalNetBb, right.totalNetBb);
  }
  if (sort === "max-loss") {
    return compareAsc(left.maxLossBb, right.maxLossBb) ||
      compareDesc(left.totalNetBb, right.totalNetBb);
  }
  if (sort === "recent") {
    return compareDesc(left.recentAverageNetBb, right.recentAverageNetBb) ||
      compareDesc(left.totalNetBb, right.totalNetBb);
  }
  if (sort === "top-three") {
    return compareDesc(left.topThreeFinishes, right.topThreeFinishes) ||
      compareDesc(left.wins, right.wins) ||
      compareDesc(left.totalNetBb, right.totalNetBb);
  }
  if (sort === "rank-rate") {
    return compareNullableAsc(left.averageRankRate, right.averageRankRate) ||
      compareDesc(left.totalNetBb, right.totalNetBb);
  }
  return compareDesc(left.totalNetBb, right.totalNetBb) ||
    compareDesc(left.averageNetBb, right.averageNetBb);
}

function compareDesc(left: number, right: number): number {
  return right - left;
}

function compareAsc(left: number, right: number): number {
  return left - right;
}

function compareNullableAsc(left: number | null, right: number | null): number {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left - right;
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
