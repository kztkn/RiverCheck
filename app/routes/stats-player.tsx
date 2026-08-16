import { GroupSiteHeader } from "~/components/site-menu";
import { useEffect, useState } from "react";
import { Link, redirect, useNavigation } from "react-router";
import { PlayerProfileEditor } from "~/components/player-profile-editor";
import { PlayerPerformanceChart } from "~/components/player-performance-chart";
import { PlayerAvatar } from "~/components/player-avatar";
import { FavoriteHandDisplay } from "~/components/playing-card";
import { AchievementBadge } from "~/components/achievement-badge";
import { PlayerAchievementCollectionView } from "~/components/player-achievement-collection";
import {
  PlayerGameHistory,
  PlayerStatsOverview,
} from "~/components/player-stats-detail";
import { buildPlayerAvatarUrl } from "@domain/player-profile/build-player-avatar-url";
import { formatSignedBbValue } from "@domain/score/bb-score";
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
  const [showProfileSavedToast, setShowProfileSavedToast] = useState(
    loaderData.profileSaved,
  );
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

  useEffect(() => {
    if (!loaderData.profileSaved) {
      setShowProfileSavedToast(false);
      return;
    }
    setShowProfileSavedToast(true);
    const url = new URL(window.location.href);
    url.searchParams.delete("profileSaved");
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
    const timeoutId = window.setTimeout(
      () => setShowProfileSavedToast(false),
      3_000,
    );
    return () => window.clearTimeout(timeoutId);
  }, [loaderData.profileSaved]);

  return (
    <main className="page-shell stats-page stats-player-page">
      <GroupSiteHeader groupCode={group.publicCode} />

      <section className="stats-intro stats-player-intro" id="profile-summary">
        <div className="stats-profile-header">
          <div className="stats-profile-identity">
            <PlayerAvatar
              avatarUrl={avatarUrl}
              className="player-avatar-large"
              displayName={summary.displayName}
            />
            <div className="stats-profile-copy">
              <p className="stats-brand-label">PLAYER PROFILE</p>
              <h1>{summary.displayName}</h1>
              {achievements.equippedAchievement ? (
                <AchievementBadge achievement={achievements.equippedAchievement} />
              ) : null}
            </div>
          </div>
        </div>
        {summary.profileMessage ? (
          <p className="stats-profile-message">{summary.profileMessage}</p>
        ) : null}
        {summary.favoriteCard1 && summary.favoriteCard2 ? (
          <div className="stats-favorite-hand">
            <span className="stats-hand-label">MY HAND</span>
            <FavoriteHandDisplay
              card1={summary.favoriteCard1}
              card2={summary.favoriteCard2}
            />
          </div>
        ) : null}
        {loaderData.canEditProfile ? (
          <div className="stats-profile-actions">
            <Link
              className="stats-profile-edit-button"
              to={`${profilePath}?editProfile=1`}
            >
              編集 <span aria-hidden="true">›</span>
            </Link>
          </div>
        ) : null}
      </section>

      {showProfileSavedToast ? (
        <div className="app-toast" role="status">
          <span aria-hidden="true">✓</span>
          プロフィールを保存しました。
        </div>
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

      <PlayerStatsOverview summary={summary} />

      <PlayerAchievementCollectionView
        collection={achievements}
      />

      <section className="stats-chart-section" aria-labelledby="chart-heading">
        <div className="section-heading stats-section-heading">
          <h2 id="chart-heading">累計損益BB推移</h2>
          <span className="stats-chart-current">
            現在
            <strong className={getBbToneClass(summary.totalNetBb)}>
              {formatSignedBbValue(summary.totalNetBb)}
            </strong>
          </span>
        </div>
        {games.length === 0 ? (
          <div className="mini-empty"><p>確定済みの戦績がまだありません。</p></div>
        ) : (
          <PlayerPerformanceChart games={games} />
        )}
      </section>

      <PlayerGameHistory
        games={recentGames}
        groupCode={group.publicCode}
      />
    </main>
  );
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
