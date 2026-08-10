import { GroupSiteHeader } from "~/components/site-menu";
import { Link, redirect, useNavigation } from "react-router";
import { PlayerProfileEditor } from "~/components/player-profile-editor";
import { PlayerPerformanceChart } from "~/components/player-performance-chart";
import { PlayerAvatar } from "~/components/player-avatar";
import { FavoriteHandDisplay } from "~/components/playing-card";
import { AchievementBadge } from "~/components/achievement-badge";
import { PlayerAchievementCollectionView } from "~/components/player-achievement-collection";
import { buildPlayerAvatarUrl } from "@domain/player-profile/build-player-avatar-url";
import { formatSignedBbValue } from "@domain/score/bb-score";
import { formatOrdinal } from "@domain/ranking/format-ordinal";
import { getPlayerStatsDetail } from "@server/services/player-stats-service.server";
import { getAuthenticatedPlayerProfile, savePlayerProfile } from "@server/services/player-profile-service.server";
import type { Route } from "./+types/stats-player";

export async function loader({ request, params }: Route.LoaderArgs) {
  const [overview, authenticated] = await Promise.all([
    getPlayerStatsDetail(params.groupCode, params.groupPlayerId),
    getAuthenticatedPlayerProfile(request, params.groupCode),
  ]);
  if (!overview) throw new Response("Player not found", { status: 404 });
  return {
    ...overview,
    canEditProfile:
      authenticated?.profile?.groupPlayerId === params.groupPlayerId,
    profileSaved: new URL(request.url).searchParams.has("profileSaved"),
    profileEditorOpen:
      new URL(request.url).searchParams.get("editProfile") === "1",
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const authenticated = await getAuthenticatedPlayerProfile(request, params.groupCode);
  if (!authenticated?.profile || authenticated.profile.groupPlayerId !== params.groupPlayerId) {
    throw new Response("Forbidden", { status: 403 });
  }
  const formData = await request.formData();
  if (readString(formData, "intent") !== "save-profile") {
    throw new Response("Bad Request", { status: 400 });
  }
  const avatarEntry = formData.get("avatar");
  const avatar = avatarEntry instanceof File && avatarEntry.size > 0 ? avatarEntry : null;
  const result = await savePlayerProfile(authenticated.profile, {
    avatar,
    equippedAchievementId: readNullableString(formData, "equippedAchievementId"),
    removeAvatar: readString(formData, "removeAvatar") === "yes",
    values: {
      displayName: authenticated.profile.displayName,
      profileMessage: readString(formData, "profileMessage"),
      favoriteCard1: readString(formData, "favoriteCard1"),
      favoriteCard2: readString(formData, "favoriteCard2"),
    },
  });
  return result.ok
    ? redirect(`/g/${params.groupCode}/stats/${params.groupPlayerId}?profileSaved=1`, { status: 303 })
    : result;
}

export default function StatsPlayer({ loaderData, actionData }: Route.ComponentProps) {
  const { achievements, group, playerStats } = loaderData;
  const { summary, games } = playerStats;
  const recentGames = [...games].reverse();
  const navigation = useNavigation();
  const profileSaveFailure = actionData?.ok === false ? actionData : null;
  const isSavingProfile =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "save-profile";
  const profilePath = `/g/${group.publicCode}/stats/${summary.groupPlayerId}`;
  const avatarUrl = buildPlayerAvatarUrl({
    avatarUpdatedAt: summary.avatarUpdatedAt,
    groupCode: group.publicCode,
    groupPlayerId: summary.groupPlayerId,
  });

  return (
    <main className="page-shell stats-page">
      <GroupSiteHeader groupCode={group.publicCode} />

      <section className="stats-intro stats-player-intro" id="profile-summary">
        <div className="stats-profile-topline">
          <PlayerAvatar
            avatarUrl={avatarUrl}
            className="player-avatar-large"
            displayName={summary.displayName}
          />
          {loaderData.canEditProfile ? (
            <Link
              className="stats-profile-edit-button"
              to={`${profilePath}?editProfile=1`}
            >
              プロフィールを編集
            </Link>
          ) : null}
        </div>
        <div className="stats-profile-copy">
          <p className="eyebrow">PLAYER PROFILE</p>
          <h1>{summary.displayName}</h1>
          {achievements.equippedAchievement ? (
            <AchievementBadge achievement={achievements.equippedAchievement} />
          ) : null}
          {summary.profileMessage ? (
            <p className="stats-profile-message">{summary.profileMessage}</p>
          ) : null}
        </div>
        {summary.favoriteCard1 && summary.favoriteCard2 ? (
          <div className="stats-favorite-hand">
            <span className="eyebrow">MY HAND</span>
            <FavoriteHandDisplay
              card1={summary.favoriteCard1}
              card2={summary.favoriteCard2}
            />
          </div>
        ) : null}
      </section>

      {loaderData.profileSaved ? (
        <p className="success-notice" role="status">プロフィールを保存しました。</p>
      ) : null}

      {loaderData.canEditProfile ? (
        <section
          aria-label="プロフィールを編集"
          aria-modal="true"
          className={`profile-edit-modal${loaderData.profileEditorOpen || profileSaveFailure ? " is-open" : ""}`}
          role="dialog"
        >
          <a aria-label="プロフィール編集を閉じる" className="profile-edit-modal-backdrop" href={profilePath} />
          <div className="profile-edit-modal-card">
            <PlayerProfileEditor
              achievements={achievements.items
                .filter((achievement) => achievement.isUnlocked)
                .map((achievement) => ({
                  id: achievement.id,
                  code: achievement.code,
                  name: achievement.name,
                  description: achievement.description,
                  iconKey: achievement.iconKey,
                  category: achievement.category,
                }))}
              avatarUrl={avatarUrl}
              error={profileSaveFailure?.error ?? null}
              errors={profileSaveFailure?.errors ?? {}}
              isSubmitting={isSavingProfile}
              modalCloseHref={profilePath}
              profile={{
                displayName: summary.displayName,
                favoriteCard1: summary.favoriteCard1,
                favoriteCard2: summary.favoriteCard2,
                profileMessage: summary.profileMessage,
                equippedAchievementId: achievements.equippedAchievement?.id ?? null,
              }}
              values={profileSaveFailure
                ? {
                    ...profileSaveFailure.values,
                    equippedAchievementId: profileSaveFailure.equippedAchievementId,
                  }
                : null}
            />
          </div>
        </section>
      ) : null}

      <section className="stats-kpi-grid" aria-label="戦績サマリー">
        <Kpi label="参加回数" value={`${summary.gamesPlayed}回`} />
        <Kpi label="優勝回数" value={`${summary.wins}回`} />
        <Kpi label="優勝率" value={formatPercent(summary.winRate)} />
        <Kpi
          label="平均順位"
          value={summary.gamesPlayed === 0 ? "—" : formatDecimal(summary.averageRank)}
        />
        <Kpi label="累計損益" tone={getBbToneClass(summary.totalNetBb)} value={formatSignedBbValue(summary.totalNetBb)} />
        <Kpi label="平均損益" tone={getBbToneClass(summary.averageNetBb)} value={formatSignedBbValue(summary.averageNetBb)} />
        <Kpi label="最大勝ち" tone={getBbToneClass(summary.maxWinBb)} value={formatSignedBbValue(summary.maxWinBb)} />
        <Kpi label="最大負け" tone={getBbToneClass(summary.maxLossBb)} value={formatSignedBbValue(summary.maxLossBb)} />
      </section>

      <PlayerAchievementCollectionView
        collection={achievements}
        groupCode={group.publicCode}
      />

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
                  <small>{formatOrdinal(game.rank)}・リバイ {game.rebuyCount}回</small>
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

function readString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function readNullableString(formData: FormData, name: string): string | null {
  const value = readString(formData, name).trim();
  return value === "" ? null : value;
}
