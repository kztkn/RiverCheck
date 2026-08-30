import { GroupSiteHeader } from "~/components/site-menu";
import { useEffect, useState } from "react";
import { Link, redirect, useNavigation } from "react-router";
import { PushNotificationSetting } from "~/components/push-notification-setting";
import { PlayerProfileEditor } from "~/components/player-profile-editor";
import { PlayerPerformanceChart } from "~/components/player-performance-chart";
import { PlayerAvatar } from "~/components/player-avatar";
import { PlayerChoiceList } from "~/components/player-choice-list";
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
import {
  getAuthenticatedPlayerProfile,
  savePlayerProfile,
  selectPlayerProfile,
} from "@server/services/player-profile-service.server";
import { getPlayerManagement } from "@server/services/player-service.server";
import { createPlayerProfileCookie } from "@server/services/player-profile-session.server";
import {
  disablePlayerPushSubscription,
  getPlayerPushSettings,
  savePlayerPushSubscription,
} from "@server/services/push-notification-service.server";
import type { Route } from "./+types/stats-player";

export async function loader({ request, params }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const [overview, authenticated] = await Promise.all([
    getPlayerStatsDetail(params.groupCode, params.groupPlayerId),
    getAuthenticatedPlayerProfile(request, params.groupCode),
  ]);
  if (!overview) throw new Response("Player not found", { status: 404 });
  const canEditProfile =
    authenticated?.profile?.groupPlayerId === params.groupPlayerId;
  const profileEditorOpen = url.searchParams.get("editProfile") === "1";
  const switchPlayerOpen =
    canEditProfile && url.searchParams.get("switchPlayer") === "1";
  const switchManagement = switchPlayerOpen
    ? await getPlayerManagement(params.groupCode)
    : null;
  return {
    ...overview,
    canEditProfile,
    pushNotificationSettings:
      canEditProfile && profileEditorOpen && authenticated?.profile
      ? await getPlayerPushSettings(
          authenticated.profile.playerId,
          authenticated.profile.groupPlayerId,
        )
      : null,
    profileSaved: url.searchParams.has("profileSaved"),
    profileEditorOpen,
    switchPlayerOpen,
    switchPlayers: (switchManagement?.players ?? [])
      .filter(
        (player) =>
          player.isActive && player.id !== authenticated?.profile?.groupPlayerId,
      )
      .map((player) => ({
        id: player.id,
        displayName: player.displayName,
        avatarUrl: buildPlayerAvatarUrl({
          avatarUpdatedAt: player.avatarUpdatedAt,
          groupCode: params.groupCode,
          groupPlayerId: player.id,
        }),
      })),
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const authenticated = await getAuthenticatedPlayerProfile(
    request,
    params.groupCode,
  );
  if (
    !authenticated?.profile ||
    authenticated.profile.groupPlayerId !== params.groupPlayerId
  ) {
    throw new Response("Forbidden", { status: 403 });
  }
  const formData = await request.formData();
  const intent = readString(formData, "intent");
  if (intent === "switch-player") {
    const groupPlayerId = readString(formData, "groupPlayerId");
    if (!isUuid(groupPlayerId)) {
      return {
        ok: false as const,
        intent: "switch-player" as const,
        error: "変更先のプレイヤーを選んでください。",
      };
    }
    if (groupPlayerId === authenticated.profile.groupPlayerId) {
      return {
        ok: false as const,
        intent: "switch-player" as const,
        error: "現在この端末で使っているプレイヤーです。",
      };
    }
    const selected = await selectPlayerProfile(params.groupCode, groupPlayerId);
    if (!selected.ok) {
      return {
        ok: false as const,
        intent: "switch-player" as const,
        error: selected.error,
      };
    }
    return redirect(
      `/g/${params.groupCode}/stats/${selected.profile.groupPlayerId}`,
      {
        status: 303,
        headers: {
          "Set-Cookie": createPlayerProfileCookie(request, selected.sessionToken),
        },
      },
    );
  }
  if (intent === "enable-push") {
    const result = await savePlayerPushSubscription(
      authenticated.profile.playerId,
      authenticated.profile.groupPlayerId,
      {
        endpoint: readString(formData, "endpoint"),
        p256dh: readString(formData, "p256dh"),
        auth: readString(formData, "auth"),
      },
    );
    return { ...result, intent: "enable-push" as const };
  }
  if (intent === "disable-push") {
    await disablePlayerPushSubscription(authenticated.profile.groupPlayerId);
    return { ok: true as const, intent: "disable-push" as const };
  }
  if (intent !== "save-profile") {
    throw new Response("Bad Request", { status: 400 });
  }
  const avatarEntry = formData.get("avatar");
  const avatar =
    avatarEntry instanceof File && avatarEntry.size > 0 ? avatarEntry : null;
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
    ? redirect(
        `/g/${params.groupCode}/stats/${params.groupPlayerId}?profileSaved=1`,
        { status: 303 },
      )
    : { ...result, intent: "save-profile" as const };
}

export default function StatsPlayer({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { achievements, group, playerStats } = loaderData;
  const { summary, games } = playerStats;
  const recentGames = [...games].reverse();
  const navigation = useNavigation();
  const [showProfileSavedToast, setShowProfileSavedToast] = useState(
    loaderData.profileSaved,
  );
  const profileSaveFailure =
    actionData?.intent === "save-profile" && actionData.ok === false
      ? actionData
      : null;
  const switchPlayerFailure =
    actionData?.intent === "switch-player" && actionData.ok === false
      ? actionData
      : null;
  const isSwitchingPlayer =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "switch-player";
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
                <AchievementBadge
                  achievement={achievements.equippedAchievement}
                />
              ) : null}
            </div>
          </div>
          {loaderData.canEditProfile ? (
            <Link
              className="stats-profile-edit-button"
              to={`${profilePath}?editProfile=1`}
            >
              編集 <span aria-hidden="true">›</span>
            </Link>
          ) : null}
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
          <a
            aria-label="プロフィール編集を閉じる"
            className="profile-edit-modal-backdrop"
            href={profilePath}
          />
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
              notificationSetting={loaderData.pushNotificationSettings ? (
                <PushNotificationSetting
                  groupName={group.name}
                  settings={loaderData.pushNotificationSettings}
                />
              ) : null}
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

      {loaderData.canEditProfile ? (
        <section className="stats-device-player-switch">
          <div>
            <span>この端末で使うプレイヤー</span>
            <strong>{summary.displayName}</strong>
          </div>
          <Link
            className="stats-device-player-switch-link"
            to={`${profilePath}?switchPlayer=1`}
          >
            この端末のプレイヤーを変更
          </Link>
        </section>
      ) : null}

      {loaderData.canEditProfile ? (
        <section
          aria-label="この端末のプレイヤーを変更"
          aria-modal="true"
          className={`profile-edit-modal device-player-switch-modal${
            loaderData.switchPlayerOpen || switchPlayerFailure ? " is-open" : ""
          }`}
          role="dialog"
        >
          <a
            aria-label="プレイヤー変更を閉じる"
            className="profile-edit-modal-backdrop"
            href={profilePath}
          />
          <div className="profile-edit-modal-card device-player-switch-card">
            <header className="device-player-switch-heading">
              <div>
                <p className="eyebrow">DEVICE PLAYER</p>
                <h2>この端末のプレイヤーを変更</h2>
              </div>
              <Link
                aria-label="プレイヤー変更を閉じる"
                className="profile-edit-modal-close"
                to={profilePath}
              >
                ×
              </Link>
            </header>
            <p className="muted-copy device-player-switch-description">
              名前を間違えて選択した場合などの変更用です。変更先を確定するまでは、現在のプレイヤーのままです。
            </p>
            {switchPlayerFailure ? (
              <p className="error-notice" role="alert">
                {switchPlayerFailure.error}
              </p>
            ) : null}
            {loaderData.switchPlayers.length > 0 ? (
              <PlayerChoiceList
                actionLabel="変更"
                confirmBeforeSubmit
                confirmationKind="switch"
                intent="switch-player"
                isSubmitting={isSwitchingPlayer}
                players={loaderData.switchPlayers}
              />
            ) : (
              <p className="muted-copy">変更できるほかのプレイヤーがいません。</p>
            )}
          </div>
        </section>
      ) : null}
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

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}
