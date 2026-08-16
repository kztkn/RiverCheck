import { GroupSiteHeader } from "~/components/site-menu";
import { Form, Link, redirect, useNavigation } from "react-router";
import { PlayerAvatar } from "~/components/player-avatar";
import { AppToast } from "~/components/app-toast";
import { IconEdit, IconPlus } from "@tabler/icons-react";
import {
  addPlayerForGroup,
  getPlayerManagement,
  readAddPlayerForm,
  renamePlayerForGroup,
} from "@server/services/player-service.server";
import { buildPlayerAvatarUrl } from "@domain/player-profile/build-player-avatar-url";
import { PLAYER_DISPLAY_NAME_MAX_LENGTH } from "@domain/player-profile/validate-player-profile";
import { requireOrganizer } from "@server/services/organizer-auth.server";
import type { Route } from "./+types/players";

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireOrganizer(request, params.groupCode);
  const management = await getPlayerManagement(params.groupCode);
  if (!management) throw new Response("Group not found", { status: 404 });

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
    added: new URL(request.url).searchParams.has("added"),
    renamed: new URL(request.url).searchParams.has("renamed"),
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  await requireOrganizer(request, params.groupCode);
  const formData = await request.formData();
  const intent = readString(formData, "intent") || "add-player";

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
  const renameFailure = actionData?.ok === false &&
    "intent" in actionData &&
    actionData.intent === "rename-player"
    ? actionData
    : null;
  const errors = addFailure?.errors ?? {};
  const displayName = addFailure?.values.displayName ?? "";

  return (
    <main className="page-shell form-page">
      <GroupSiteHeader groupCode={loaderData.group.publicCode} organizer />

      <section className="form-intro member-management-intro">
        <p className="eyebrow">MEMBERS</p>
        <h1>メンバー管理</h1>
        <p>参加するプレイヤーの登録と表示名を管理します。</p>
      </section>

      <AppToast
        message={loaderData.added ? "メンバーを追加しました。" : null}
        searchParam="added"
      />

      <AppToast
        message={loaderData.renamed ? "表示名を変更しました。" : null}
        searchParam="renamed"
      />

      <div className="member-management">
        <Form
          action={`/g/${loaderData.group.publicCode}/players`}
          className="member-add-form"
          method="post"
          noValidate
          reloadDocument
        >
          <input name="intent" type="hidden" value="add-player" />
          <div className="member-add-heading">
            <span aria-hidden="true"><IconPlus /></span>
            <div>
              <h2>メンバーを追加</h2>
              <p>開催に参加する名前を名簿へ登録します。</p>
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
            {isSubmitting && submittingIntent === "add-player" ? "追加中…" : "メンバーを追加"}
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
                      action={`/g/${loaderData.group.publicCode}/players`}
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
                      </label>
                      {renameFailure?.groupPlayerId === player.id ? (
                        <p className="field-error" role="alert">{renameFailure.error}</p>
                      ) : null}
                      <div className="member-rename-actions">
                        <Link
                          className="button button-ghost"
                          reloadDocument
                          to={`/g/${loaderData.group.publicCode}/players`}
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
