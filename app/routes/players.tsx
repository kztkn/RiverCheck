import { GroupSiteHeader } from "~/components/site-menu";
import { ReusablePlayerPicker } from "~/components/reusable-player-picker";
import { Form, Link, redirect, useNavigation } from "react-router";
import { PlayerAvatar } from "~/components/player-avatar";
import { AppToast } from "~/components/app-toast";
import { IconEdit, IconPlus } from "@tabler/icons-react";
import {
  addExistingPlayerForGroup,
  addPlayerForGroup,
  getPlayerManagement,
  readAddPlayerForm,
  renamePlayerForGroup,
  removePlayerFromGroup,
} from "@server/services/player-service.server";
import { buildPlayerAvatarUrl } from "@domain/player-profile/build-player-avatar-url";
import { PLAYER_DISPLAY_NAME_MAX_LENGTH } from "@domain/player-profile/validate-player-profile";
import { requireOrganizer } from "@server/services/organizer-auth.server";
import type { Route } from "./+types/players";

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireOrganizer(request, params.groupCode);
  const management = await getPlayerManagement(params.groupCode);
  if (!management) throw new Response("Group not found", { status: 404 });

  const url = new URL(request.url);
  return {
    ...management,
    players: management.players.map((player) => ({
      ...player,
      avatarUrl: buildPlayerAvatarUrl({
        avatarUpdatedAt: player.avatarUpdatedAt,
        groupCode: params.groupCode,
        groupPlayerId: player.id,
      }),
    })),
    reusablePlayers: management.reusablePlayers.map((player) => ({
      ...player,
      avatarUrl:
        player.sourceGroupCode && player.sourceGroupPlayerId
          ? buildPlayerAvatarUrl({
              avatarUpdatedAt: player.avatarUpdatedAt,
              groupCode: player.sourceGroupCode,
              groupPlayerId: player.sourceGroupPlayerId,
            })
          : null,
    })),
    added: url.searchParams.has("added"),
    linked: url.searchParams.has("linked"),
    renamed: url.searchParams.has("renamed"),
    removed: url.searchParams.has("removed"),
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  await requireOrganizer(request, params.groupCode);
  const formData = await request.formData();
  const intent = readString(formData, "intent") || "add-player";

  if (intent === "add-existing-player") {
    const playerId = readString(formData, "playerId");
    if (!isUuid(playerId)) {
      return {
        ok: false as const,
        intent,
        error: "プロフィールを確認できません。",
      };
    }
    const result = await addExistingPlayerForGroup(params.groupCode, playerId);
    if (!result.ok) return { ...result, intent };
    return redirect(`/g/${params.groupCode}/players?linked=1`);
  }

  if (intent === "remove-player") {
    const groupPlayerId = readString(formData, "groupPlayerId");
    if (!isUuid(groupPlayerId)) {
      return {
        ok: false as const,
        intent,
        error: "メンバーを確認できません。",
        groupPlayerId,
      };
    }
    const result = await removePlayerFromGroup(params.groupCode, groupPlayerId);
    if (!result.ok) return { ...result, intent, groupPlayerId };
    return redirect(`/g/${params.groupCode}/players?removed=1`);
  }

  if (intent === "rename-player") {
    const groupPlayerId = readString(formData, "groupPlayerId");
    if (!isUuid(groupPlayerId)) {
      return {
        ok: false as const,
        intent,
        error: "メンバーを確認できません。",
        groupPlayerId,
        value: readString(formData, "displayName"),
      };
    }
    const result = await renamePlayerForGroup(
      params.groupCode,
      groupPlayerId,
      readString(formData, "displayName"),
    );
    if (!result.ok) return { ...result, intent, groupPlayerId };
    return redirect(`/g/${params.groupCode}/players?renamed=1`);
  }

  const values = readAddPlayerForm(formData);
  const result = await addPlayerForGroup(params.groupCode, values);
  if (!result.ok) return { ...result, intent: "add-player" as const };
  return redirect(`/g/${params.groupCode}/players?added=1`);
}

export default function Players({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const submittingIntent = navigation.formData?.get("intent");
  const addFailure = actionData?.ok === false &&
    "intent" in actionData &&
    actionData.intent === "add-player" &&
    "errors" in actionData &&
    "values" in actionData
    ? actionData
    : null;
  const existingFailure = actionData?.ok === false &&
    "intent" in actionData &&
    actionData.intent === "add-existing-player" &&
    "error" in actionData
    ? actionData
    : null;
  const renameFailure = actionData?.ok === false &&
    "intent" in actionData &&
    actionData.intent === "rename-player"
    ? actionData
    : null;
  const removeFailure =
    actionData?.ok === false &&
    "intent" in actionData &&
    actionData.intent === "remove-player"
      ? actionData
      : null;
  const errors = addFailure?.errors ?? {};
  const displayName = addFailure?.values.displayName ?? "";
  const actionUrl = `/g/${loaderData.group.publicCode}/players`;

  return (
    <main className="page-shell form-page">
      <GroupSiteHeader groupCode={loaderData.group.publicCode} organizer />

      <section className="form-intro member-management-intro">
        <p className="eyebrow">MEMBERS</p>
        <h1>メンバー管理</h1>
        <p>
          このグループのメンバーを管理します。表示名やアイコンなどのプロフィールはグループ間で共通です。
        </p>
      </section>

      <AppToast
        message={loaderData.added ? "新しいメンバーを追加しました。" : null}
        searchParam="added"
      />

      <AppToast
        message={loaderData.linked ? "既存プロフィールをこのグループに追加しました。" : null}
        searchParam="linked"
      />

      <AppToast
        message={loaderData.renamed ? "表示名を変更しました。" : null}
        searchParam="renamed"
      />

      <AppToast
        message={loaderData.removed ? "メンバーをグループから外しました。" : null}
        searchParam="removed"
      />

      <div className="member-management">
        <ReusablePlayerPicker
          action={actionUrl}
          currentMemberCount={loaderData.players.length}
          players={loaderData.reusablePlayers}
        />
        {existingFailure ? (
          <p className="error-notice" role="alert">{existingFailure.error}</p>
        ) : null}

        <Form
          action={actionUrl}
          className="member-add-form"
          method="post"
          noValidate
          reloadDocument
        >
          <input name="intent" type="hidden" value="add-player" />
          <div className="member-add-heading">
            <span aria-hidden="true"><IconPlus /></span>
            <div>
              <h2>新しいメンバーを追加</h2>
              <p>ほかのグループにいない人だけ、新しいプロフィールとして登録します。</p>
            </div>
          </div>

          <label className="field" htmlFor="displayName">
            <span className="field-label">表示名</span>
            <span className="input-wrap">
              <input
                aria-describedby={errors.displayName ? "displayName-error" : undefined}
                aria-invalid={Boolean(errors.displayName)}
                defaultValue={displayName}
                id="displayName"
                maxLength={PLAYER_DISPLAY_NAME_MAX_LENGTH}
                name="displayName"
                placeholder="例：プレイヤー"
                required
              />
            </span>
            <span className="field-hint">最大{PLAYER_DISPLAY_NAME_MAX_LENGTH}文字</span>
            {errors.displayName ? (
              <span className="field-error" id="displayName-error">{errors.displayName}</span>
            ) : null}
          </label>

          <button
            className="button button-primary"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting && submittingIntent === "add-player" ? "追加中…" : "新規プロフィールを追加"}
          </button>
        </Form>

        <section className="member-roster" aria-labelledby="member-list-heading">
          <div className="member-roster-heading">
            <h2 id="member-list-heading">登録済みメンバー</h2>
            <span className="count-badge">{loaderData.players.length}人</span>
          </div>

          {loaderData.players.length === 0 ? (
            <div className="mini-empty"><p>まだメンバーはいません。</p></div>
          ) : (
            <ul className="member-list profile-member-list">
              {loaderData.players.map((player) => (
                <li key={player.id}>
                  <details
                    className="member-rename-disclosure"
                    open={renameFailure?.groupPlayerId === player.id || undefined}
                  >
                    <summary aria-label={`${player.displayName}さんの表示名を編集`}>
                      <PlayerAvatar avatarUrl={player.avatarUrl} displayName={player.displayName} />
                      <span className="profile-member-name">
                        <strong>{player.displayName}</strong>
                        <small>{player.hasProfileAccess ? "本人端末 設定済み" : "本人端末 未設定"}</small>
                      </span>
                      <span
                        aria-hidden="true"
                        className="member-edit-action"
                        title="表示名を編集"
                      >
                        <IconEdit />
                      </span>
                    </summary>
                    <Form
                      action={actionUrl}
                      className="member-rename-form"
                      method="post"
                      noValidate
                      reloadDocument
                    >
                      <input name="intent" type="hidden" value="rename-player" />
                      <input name="groupPlayerId" type="hidden" value={player.id} />
                      <label className="field">
                        <span className="field-label">表示名</span>
                        <input
                          defaultValue={
                            renameFailure?.groupPlayerId === player.id
                              ? renameFailure.value
                              : player.displayName
                          }
                          maxLength={PLAYER_DISPLAY_NAME_MAX_LENGTH}
                          name="displayName"
                          required
                        />
                        <span className="field-hint">
                          表示名は同じプロフィールを使うすべてのグループに反映されます。
                        </span>
                      </label>
                      {renameFailure?.groupPlayerId === player.id ? (
                        <p className="field-error" role="alert">{renameFailure.error}</p>
                      ) : null}
                      <div className="member-rename-actions">
                        <Link
                          className="button button-ghost"
                          reloadDocument
                          to={actionUrl}
                        >
                          キャンセル
                        </Link>
                        <button className="button button-primary" disabled={isSubmitting} type="submit">
                          {isSubmitting &&
                            submittingIntent === "rename-player" &&
                            navigation.formData?.get("groupPlayerId") === player.id
                            ? "保存中…"
                            : "保存"}
                        </button>
                      </div>
                    </Form>
                    <div className="member-membership-note">
                      <strong>グループ所属</strong>
                      <p>外しても過去の開催・順位・戦績は残ります。必要になればあとで再追加できます。</p>
                      <Form action={actionUrl} method="post" reloadDocument>
                        <input name="intent" type="hidden" value="remove-player" />
                        <input name="groupPlayerId" type="hidden" value={player.id} />
                        <button
                          className="text-button member-remove-from-group"
                          disabled={isSubmitting}
                          onClick={(event) => {
                            if (!window.confirm(`${player.displayName}さんをこのグループから外しますか？\n過去の戦績は残ります。`)) {
                              event.preventDefault();
                            }
                          }}
                          type="submit"
                        >
                          このグループから外す
                        </button>
                      </Form>
                      {removeFailure?.groupPlayerId === player.id ? (
                        <p className="field-error" role="alert">{removeFailure.error}</p>
                      ) : null}
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function readString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}

export function headers() {
  return {
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
  };
}
