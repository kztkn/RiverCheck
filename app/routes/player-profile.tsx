import { GroupSiteHeader } from "~/components/site-menu";
import { Form, redirect, useNavigation } from "react-router";
import { PlayerProfileEditor } from "~/components/player-profile-editor";
import { AppToast } from "~/components/app-toast";
import { PlayerChoiceList } from "~/components/player-choice-list";
import {
  getAuthenticatedPlayerProfile,
  savePlayerProfile,
  selectPlayerProfile,
} from "@server/services/player-profile-service.server";
import {
  addPlayerForGroup,
  getPlayerManagement,
} from "@server/services/player-service.server";
import { createPlayerProfileCookie } from "@server/services/player-profile-session.server";
import { buildPlayerAvatarUrl } from "@domain/player-profile/build-player-avatar-url";
import { PLAYER_DISPLAY_NAME_MAX_LENGTH } from "@domain/player-profile/validate-player-profile";
import { getPlayerAchievementCollection } from "@server/services/achievement-service.server";
import type { Route } from "./+types/player-profile";

export async function loader({ request, params }: Route.LoaderArgs) {
  const overview = await getAuthenticatedPlayerProfile(request, params.groupCode);
  if (!overview) throw new Response("Group not found", { status: 404 });
  const url = new URL(request.url);
  const profile = overview.profile;
  const achievements = profile
    ? await getPlayerAchievementCollection(overview.group.id, profile.groupPlayerId)
    : null;
  const management = profile
    ? null
    : await getPlayerManagement(params.groupCode);
  return {
    group: overview.group,
    profile: profile
      ? {
        avatarUpdatedAt: profile.avatarUploadedAt,
        displayName: profile.displayName,
        favoriteCard1: profile.favoriteCard1,
        favoriteCard2: profile.favoriteCard2,
        equippedAchievementId: profile.equippedAchievementId,
        groupPlayerId: profile.groupPlayerId,
        profileMessage: profile.profileMessage,
        updatedAt: profile.updatedAt,
      }
      : null,
    achievements: (achievements?.items ?? [])
      .filter((achievement) => achievement.isUnlocked)
      .map((achievement) => ({
        id: achievement.id,
        code: achievement.code,
        name: achievement.name,
        description: achievement.description,
        iconKey: achievement.iconKey,
        category: achievement.category,
      })),
    avatarUrl: profile
      ? buildPlayerAvatarUrl({
        avatarUpdatedAt: profile.avatarUploadedAt,
        groupCode: params.groupCode,
        groupPlayerId: profile.groupPlayerId,
      })
      : null,
    players: (management?.players ?? []).filter((player) => player.isActive).map(
      (player) => ({
        ...player,
        avatarUrl: buildPlayerAvatarUrl({
          avatarUpdatedAt: player.avatarUpdatedAt,
          groupCode: params.groupCode,
          groupPlayerId: player.id,
        }),
      }),
    ),
    saved: url.searchParams.has("saved"),
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const overview = await getAuthenticatedPlayerProfile(request, params.groupCode);
  if (!overview) throw new Response("Group not found", { status: 404 });
  const formData = await request.formData();
  const intent = readString(formData, "intent");

  if (intent === "select-existing") {
    const groupPlayerId = readString(formData, "groupPlayerId");
    if (!isUuid(groupPlayerId)) {
      return {
        ok: false as const,
        intent,
        error: "プレイヤーを選んでください。",
      };
    }
    const selected = await selectPlayerProfile(params.groupCode, groupPlayerId);
    if (!selected.ok) return { ...selected, intent };
    return redirect(`/g/${params.groupCode}/stats/${selected.profile.groupPlayerId}`, {
      status: 303,
      headers: {
        "Set-Cookie": createPlayerProfileCookie(
          request,
          selected.sessionToken,
        ),
      },
    });
  }

  if (intent === "create-player") {
    const displayName = readString(formData, "displayName");
    const added = await addPlayerForGroup(params.groupCode, { displayName });
    if (!added.ok) {
      return {
        ok: false as const,
        intent,
        error: added.errors.displayName ?? "プレイヤーを追加できませんでした。",
        value: displayName,
      };
    }
    const selected = await selectPlayerProfile(
      params.groupCode,
      added.groupPlayerId,
    );
    if (!selected.ok) return { ...selected, intent, value: displayName };
    return redirect(`/g/${params.groupCode}/stats/${selected.profile.groupPlayerId}`, {
      status: 303,
      headers: {
        "Set-Cookie": createPlayerProfileCookie(
          request,
          selected.sessionToken,
        ),
      },
    });
  }

  if (!overview.profile) {
    return {
      ok: false as const,
      intent: "save-profile" as const,
      error: "先にこの端末で使うプレイヤーを選んでください。",
      equippedAchievementId: null,
      values: {
        displayName: "",
        favoriteCard1: "",
        favoriteCard2: "",
        profileMessage: "",
      },
    };
  }

  const avatarEntry = formData.get("avatar");
  const avatar = avatarEntry instanceof File && avatarEntry.size > 0
    ? avatarEntry
    : null;
  const values = {
    displayName: overview.profile.displayName,
    favoriteCard1: readString(formData, "favoriteCard1"),
    favoriteCard2: readString(formData, "favoriteCard2"),
    profileMessage: readString(formData, "profileMessage"),
  };
  const result = await savePlayerProfile(overview.profile, {
    avatar,
    equippedAchievementId: readNullableString(formData, "equippedAchievementId"),
    removeAvatar: readString(formData, "removeAvatar") === "yes",
    values,
  });
  return result.ok
    ? redirect(`/g/${params.groupCode}/profile?saved=1`)
    : { ...result, intent: "save-profile" as const };
}

export default function PlayerProfileRoute({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <main className="page-shell profile-page">
      <GroupSiteHeader groupCode={loaderData.group.publicCode} />

      <section className="form-intro profile-intro">
        <h1>PLAYER PROFILE</h1>
        <p>アイコンとひとことは、RiverCheck内のあなた自身に紐付きます。</p>
      </section>

      <AppToast
        message={loaderData.saved ? "プロフィールを保存しました。" : null}
        searchParam="saved"
      />

      {loaderData.profile ? (
        <>
          <PlayerProfileEditor
            achievements={loaderData.achievements}
            avatarUrl={loaderData.avatarUrl}
            error={actionData?.ok === false &&
              actionData.intent === "save-profile" &&
              "error" in actionData
              ? actionData.error ?? null
              : null}
            errors={actionData?.ok === false &&
              actionData.intent === "save-profile" &&
              "errors" in actionData
              ? actionData.errors ?? {}
              : {}}
            isSubmitting={isSubmitting}
            key={loaderData.profile.updatedAt}
            profile={loaderData.profile}
            values={actionData?.ok === false &&
              actionData.intent === "save-profile" &&
              "values" in actionData
              ? {
                  ...actionData.values,
                  equippedAchievementId: "equippedAchievementId" in actionData
                    ? actionData.equippedAchievementId
                    : null,
                }
              : null}
          />
        </>
      ) : (
        <div className="player-selection">
          <section className="player-selection-primary">
            <div className="section-heading compact-heading">
              <div>
                <p className="eyebrow">PROFILE SETUP</p>
                <h2>あなたの名前を選択</h2>
              </div>
            </div>
            <p className="muted-copy">
              この端末では次回から自動であなたとして開きます。
            </p>
            {actionData?.ok === false && actionData.intent === "select-existing"
              ? <p className="error-notice" role="alert">{actionData.error}</p>
              : null}
            <PlayerChoiceList
              actionLabel="選択"
              intent="select-existing"
              isSubmitting={isSubmitting}
              players={loaderData.players}
            />
          </section>

          <section className="player-selection-create">
            <div>
              <h2>一覧に名前がない方</h2>
              <p className="muted-copy">新しいプレイヤーとして登録します。</p>
            </div>
            <Form className="new-player-form" method="post" noValidate>
              <input name="intent" type="hidden" value="create-player" />
              <label className="field">
                <span className="field-label">表示名（{PLAYER_DISPLAY_NAME_MAX_LENGTH}文字以内）</span>
                <input
                  defaultValue={actionData?.ok === false &&
                    actionData.intent === "create-player" &&
                    "value" in actionData
                    ? actionData.value
                    : ""}
                  maxLength={PLAYER_DISPLAY_NAME_MAX_LENGTH}
                  name="displayName"
                  required
                />
              </label>
              {actionData?.ok === false && actionData.intent === "create-player"
                ? <p className="error-notice" role="alert">{actionData.error}</p>
                : null}
              <button className="button button-secondary" disabled={isSubmitting} type="submit">
                この名前で登録
              </button>
            </Form>
          </section>
        </div>
      )}
    </main>
  );
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

export function headers() {
  return { "Cache-Control": "no-store" };
}
