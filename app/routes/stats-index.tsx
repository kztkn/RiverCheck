import { useMemo, useState, useRef, useEffect } from "react";
import { GroupSiteHeader } from "~/components/site-menu";
import { data, Form, NavLink, useActionData, useNavigate, useNavigation } from "react-router";
import { PlayerAvatar } from "~/components/player-avatar";
import { AchievementBadge } from "~/components/achievement-badge";
import { buildPlayerAvatarUrl } from "@domain/player-profile/build-player-avatar-url";
import { formatSignedBbValue } from "@domain/score/bb-score";
import { rankPlayers } from "@domain/player-stats/rank-players";
import { RankingPosition } from "~/components/ranking-position";

import type { Route } from "./+types/stats-index";
import type {
  PlayerStatsRankingRow,
  PlayerStatsSort,
} from "@shared-types/player-stats";
import { BodyPortal } from "~/components/body-portal";
import { rankSeason } from "@domain/season/season";
import { RANKING_OPTIONS } from "~/utils/ranking-options";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { parsePlayerStatsSort } = await import('@server/services/player-stats-service.server');
  const sort = parsePlayerStatsSort(new URL(request.url).searchParams.get("sort"));
  const { getSeasonOverview } = await import('@server/services/season-service.server');
  return data(await getSeasonOverview(request,params.groupCode,sort),{headers:headers()});
}
export function headers() { return { 'Cache-Control':'private, no-store' }; }
export async function action({request,params}: Route.ActionArgs) {
  const form = await request.formData();
  if (form.get('intent') !== 'finalize-season') throw new Response('Unknown action',{status:400});
  const { finalizeSeason } = await import('@server/services/season-service.server');
  return finalizeSeason(request,params.groupCode,String(form.get('season')),String(form.get('version')));
}

export default function StatsIndex({ loaderData }: Route.ComponentProps) {
  const { group, ranking, sort } = loaderData;
  const navigate = useNavigate();
  const navigation = useNavigation();
  const actionData = useActionData<typeof action>();
  const [confirming,setConfirming] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    if (!dialog.current) return;
    if (confirming && !dialog.current.open) dialog.current.showModal();
    if (!confirming && dialog.current.open) dialog.current.close();
  },[confirming]);
  useEffect(()=>{ setActiveSort(sort); setConfirming(false); },[loaderData,sort]);
  const [activeSort, setActiveSort] = useState<PlayerStatsSort>(sort);
  const visibleRanking = useMemo(
    () => loaderData.selectedSeason ? rankSeason(ranking, activeSort) : rankPlayers(ranking, activeSort),
    [ranking, activeSort, loaderData.selectedSeason],
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
      <section className="season-selector">
        <label className="field">シーズン
          <select value={loaderData.selectedSeason?.key ?? 'all'} onChange={e=>navigate(`?season=${e.target.value}&sort=${activeSort}`)}>
            {loaderData.seasons.map(season=><option key={season.key} value={season.key}>{season.name}</option>)}
            <option value="all">通算</option>
          </select>
        </label>
        {loaderData.selectedSeason ? <>
          <h2>{loaderData.selectedSeason.name} {loaderData.finalizedAt ? '確定済み' : '集計中'}</h2>
          <p>{formatSeasonDate(loaderData.selectedSeason.startAt)}〜{formatSeasonDate(new Date(Date.parse(loaderData.selectedSeason.endAt)-1).toISOString())}</p>
          <small>シーズン表彰は累計BBのみで順位を決定します。</small>
        </> : null}
        {loaderData.unavailable ? <p>シーズン機能は準備中です。通算ランキングを表示しています。</p> : null}
        {actionData?.error ? <p role="alert">{actionData.error}</p> : null}
        {loaderData.canFinalize ? <button type="button" className="button button-secondary" disabled={!ranking.length} onClick={()=>setConfirming(true)}>シーズン確定の確認</button> : null}
      </section>
      {loaderData.preview && loaderData.selectedSeason ? <BodyPortal>
        <dialog ref={dialog} className="table-event-dialog season-confirm-dialog" onCancel={()=>setConfirming(false)} aria-labelledby="season-confirm-title">
          <div className="season-confirm-body">
            <h2 id="season-confirm-title">{loaderData.selectedSeason.name}を確定</h2>
            <p>参加者 {loaderData.preview.ranking.length}人</p>
            {loaderData.preview.pendingCount > 0 ? <p role="alert">未確定の開催が{loaderData.preview.pendingCount}件残っています。</p> : null}
            <p>確定後は取り消せません。以降の開催追加・結果確定・訂正はシーズン順位と称号に反映されません。通算と年間まとめは従来どおり更新されます。</p>
            <ul>{loaderData.preview.ranking.map(player=><li key={player.groupPlayerId}>
              <strong>{player.rank}位 {player.displayName} {formatSignedBbValue(player.totalNetBb)}</strong>
              <p>{loaderData.preview?.awards.find(a=>a.groupPlayerId===player.groupPlayerId)?.titles.map(t=>t.name).join(' ／ ')}</p>
            </li>)}</ul>
            <Form method="post">
              <input type="hidden" name="intent" value="finalize-season"/>
              <input type="hidden" name="season" value={loaderData.selectedSeason.key}/>
              <input type="hidden" name="version" value={loaderData.version}/>
              <button className="button button-primary" disabled={navigation.state !== 'idle'}>順位を固定して称号を付与</button>
              <button type="button" className="button button-secondary" onClick={()=>setConfirming(false)}>戻る</button>
            </Form>
          </div>
        </dialog>
      </BodyPortal> : null}
      <section className="stats-ranking-section" aria-label="ランキング">
        <div className="section-heading stats-heading">
          <div className="stats-sort" aria-label="ランキングの並び順">
            {RANKING_OPTIONS.map((option) => (
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
                <NavLink
                  className={({ isPending }) => `stats-ranking-card${
                    player.rank <= 3 ? " is-top-three" : ""
                  }${isPending ? " is-pending" : ""}`}
                  key={player.groupPlayerId}
                  prefetch="intent"
                  to={player.groupPlayerId}
                >
                  <RankingPosition
                    rank={player.rank}
                    previousRank={player.previousRanks[activeSort]}
                  />
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
                      <span className="stats-achievement-slot">
                        {player.equippedAchievement ? (
                          <AchievementBadge
                            achievement={player.equippedAchievement}
                            compact
                          />
                        ) : (
                          <span
                            aria-hidden="true"
                            className="stats-achievement-placeholder"
                          >
                            —
                          </span>
                        )}
                      </span>
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
                    {metric.detail ? (
                      <small className="stats-primary-detail">
                        {metric.detail}
                      </small>
                    ) : null}
                  </span>
                </NavLink>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

export function getRankingMetric(
  player: PlayerStatsRankingRow,
  sort: PlayerStatsSort,
): { label: string; value: string; tone: string; detail?: string } {
  if (sort === "top-three") {
    return {
      label: "TOP3入り",
      value: `${player.topThreeFinishes}回`,
      tone: "",
      detail: `優勝${player.wins}回・2位${player.secondPlaceFinishes}回`,
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
    ? { label: "平均BB", value: player.averageNetBb }
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
          : { label: "累計BB", value: player.totalNetBb };

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

function formatSeasonDate(value: string) { return new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value)); }
