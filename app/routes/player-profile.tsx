import { GroupSiteHeader } from "~/components/site-menu";
import { Link, redirect, useNavigation } from "react-router";
import { PlayerProfileEditor } from "~/components/player-profile-editor";
import {
  getAuthenticatedPlayerProfile,
  savePlayerProfile,
} from "@server/services/player-profile-service.server";
import { buildPlayerAvatarUrl } from "@domain/player-profile/build-player-avatar-url";
import type { Route } from "./+types/player-profile";

export async function loader({ request, params }: Route.LoaderArgs) {
  const overview = await getAuthenticatedPlayerProfile(request, params.groupCode);
  if (!overview) throw new Response("Group not found", { status: 404 });
  const url = new URL(request.url);
  const profile = overview.profile;
  return {
    group: overview.group,
    profile: profile
      ? {
        avatarUpdatedAt: profile.avatarUploadedAt,
        displayName: profile.displayName,
        groupPlayerId: profile.groupPlayerId,
        profileMessage: profile.profileMessage,
        updatedAt: profile.updatedAt,
      }
      : null,
    avatarUrl: profile
      ? buildPlayerAvatarUrl({
        avatarUpdatedAt: profile.avatarUploadedAt,
        groupCode: params.groupCode,
        groupPlayerId: profile.groupPlayerId,
      })
      : null,
    saved: url.searchParams.has("saved"),
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const overview = await getAuthenticatedPlayerProfile(request, params.groupCode);
  if (!overview) throw new Response("Group not found", { status: 404 });
  if (!overview.profile) {
    return {
      ok: false as const,
      error: "この端末はプレイヤーに紐付いていません。本人用リンクを開いてください。",
      values: { displayName: "", profileMessage: "" },
    };
  }

  const formData = await request.formData();
  const avatarEntry = formData.get("avatar");
  const avatar = avatarEntry instanceof File && avatarEntry.size > 0
    ? avatarEntry
    : null;
  const values = {
    displayName: readString(formData, "displayName"),
    profileMessage: readString(formData, "profileMessage"),
  };
  const result = await savePlayerProfile(overview.profile, {
    avatar,
    removeAvatar: readString(formData, "removeAvatar") === "yes",
    values,
  });
  return result.ok
    ? redirect(`/g/${params.groupCode}/profile?saved=1`)
    : result;
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
        <p className="eyebrow">YOUR PROFILE</p>
        <h1>プレイヤー設定</h1>
        <p>名前・アイコン・ひとことは、RiverCheck内のあなた自身に紐付きます。</p>
      </section>

      {loaderData.saved ? (
        <p className="success-notice" role="status">プロフィールを保存しました。</p>
      ) : null}

      {loaderData.profile ? (
        <PlayerProfileEditor
          avatarUrl={loaderData.avatarUrl}
          error={actionData?.ok === false && "error" in actionData ? actionData.error ?? null : null}
          errors={actionData?.ok === false && "errors" in actionData ? actionData.errors ?? {} : {}}
          isSubmitting={isSubmitting}
          key={loaderData.profile.updatedAt}
          profile={loaderData.profile}
          values={actionData?.ok === false ? actionData.values : null}
        />
      ) : (
        <section className="participant-panel profile-unlinked">
          <span className="empty-icon" aria-hidden="true">♠</span>
          <h2>この機能を利用するには本人確認が必要です</h2>
          <p>主催者へ問い合わせて本人用リンクを受け取り、この端末で一度開いてください。</p>
          <Link className="button button-secondary" to={`/g/${loaderData.group.publicCode}`}>
            トップへ戻る
          </Link>
        </section>
      )}
    </main>
  );
}

function readString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export function headers() {
  return { "Cache-Control": "no-store" };
}
