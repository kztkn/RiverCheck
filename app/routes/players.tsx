import { GroupSiteHeader } from "~/components/site-menu";
import { Form, Link, redirect, useNavigation } from "react-router";
import { PlayerAvatar } from "~/components/player-avatar";
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

      <section className="form-intro">
        <h1>MEMBERS</h1>
        <p>メンバーの登録と表示名を管理します。</p>
      </section>

      {loaderData.added ? (
        <p className="success-notice" role="status">メンバーを追加しました。</p>
      ) : null}

      {loaderData.renamed ? (
        <p className="success-notice" role="status">表示名を変更しました。</p>
      ) : null}

      <div className="management-grid">
        <Form
          action={`/g/${loaderData.group.publicCode}/players`}
          className="compact-form"
          method="post"
          noValidate
          reloadDocument
        >
          <input name="intent" type="hidden" value="add-player" />
          <div className="section-heading compact-heading">
            <div>
              <h2>ADD MEMBER</h2>
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

        <section className="member-panel" aria-labelledby="member-list-heading">
          <div className="section-heading compact-heading">
            <div>
              <p className="eyebrow">ROSTER</p>
              <h2 id="member-list-heading">登録済み</h2>
            </div>
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
                        className="profile-claim-issue-button"
                        title="表示名を編集"
                      >
                        <PencilIcon />
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

function PencilIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m4 16-.8 4 4-.8L18.5 7.9l-3.2-3.2L4 16Z" />
      <path d="m13.8 6.2 3.2 3.2" />
    </svg>
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
