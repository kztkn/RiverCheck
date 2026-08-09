import { GroupSiteHeader } from "~/components/site-menu";
import { useRef, useState } from "react";
import { Form, redirect, useNavigation } from "react-router";
import { ParticipantLinkQr } from "~/components/participant-link-qr";
import { PlayerAvatar } from "~/components/player-avatar";
import {
  addPlayerForGroup,
  getPlayerManagement,
  readAddPlayerForm,
} from "@server/services/player-service.server";
import { issueProfileClaimLink } from "@server/services/player-profile-service.server";
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
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  await requireOrganizer(request, params.groupCode);
  const formData = await request.formData();
  const intent = readString(formData, "intent") || "add-player";

  if (intent === "issue-profile-claim") {
    const groupPlayerId = readString(formData, "groupPlayerId");
    if (!isUuid(groupPlayerId)) {
      return { ok: false as const, intent, error: "メンバーを確認できません。" };
    }
    const result = await issueProfileClaimLink(params.groupCode, groupPlayerId);
    if (!result.ok) return { ...result, intent };
    const origin = new URL(request.url).origin;
    return {
      ok: true as const,
      intent,
      claimUrl: `${origin}/g/${params.groupCode}/profile/claim/${result.token}`,
      displayName: result.displayName,
      expiresAt: result.expiresAt,
    };
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
  const claimInputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const isSubmitting = navigation.state === "submitting";
  const submittingIntent = navigation.formData?.get("intent");
  const addFailure = actionData?.ok === false &&
    "intent" in actionData &&
    actionData.intent === "add-player" &&
    "errors" in actionData &&
    "values" in actionData
    ? actionData
    : null;
  const claimResult = actionData?.ok === true &&
    "intent" in actionData &&
    actionData.intent === "issue-profile-claim"
    ? actionData
    : null;
  const claimError = actionData?.ok === false &&
    "intent" in actionData &&
    actionData.intent === "issue-profile-claim"
    ? actionData.error
    : null;
  const errors = addFailure?.errors ?? {};
  const displayName = addFailure?.values.displayName ?? "";

  async function copyClaimLink() {
    if (!claimResult) return;
    try {
      await navigator.clipboard.writeText(claimResult.claimUrl);
      setCopied(true);
    } catch {
      claimInputRef.current?.focus();
      claimInputRef.current?.select();
    }
  }

  return (
    <main className="page-shell form-page">
      <GroupSiteHeader groupCode={loaderData.group.publicCode} organizer />

      <section className="form-intro">
        <h1>MEMBERS</h1>
        <p>メンバー登録と、本人がプロフィールを編集するためのリンクを管理します。</p>
      </section>

      {loaderData.added ? (
        <p className="success-notice" role="status">メンバーを追加しました。</p>
      ) : null}

      {claimResult ? (
        <section className="profile-claim-share" aria-labelledby="claim-share-heading">
          <div>
            <p className="eyebrow">PERSONAL LINK</p>
            <h2 id="claim-share-heading">{claimResult.displayName}さんの本人用リンク</h2>
            <p>本人へ個別に送ってください。24時間以内に1回使うか、再発行すると無効になります。</p>
          </div>
          <div className="profile-claim-link-row">
            <input readOnly ref={claimInputRef} value={claimResult.claimUrl} />
            <button
              aria-label="本人用リンクをコピー"
              className="copy-icon-button"
              onClick={() => void copyClaimLink()}
              type="button"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="M8 8h11v11H8z" />
                <path d="M5 16H4V5h11v1" />
              </svg>
            </button>
          </div>
          <small>{copied ? "コピーしました" : `有効期限：${formatExpiry(claimResult.expiresAt)}`}</small>
          <ParticipantLinkQr
            description="読み取ると、本人確認画面が直接開きます。"
            panelId="profile-claim-link-qr"
            panelTitle={`${claimResult.displayName}さんの端末で読み取ってください`}
            qrTitle={`${claimResult.displayName}さんの本人用リンクのQRコード`}
            url={claimResult.claimUrl}
          />
        </section>
      ) : null}
      {claimError ? <p className="error-notice" role="alert">{claimError}</p> : null}

      <div className="management-grid">
        <Form className="compact-form" method="post" noValidate>
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
                placeholder="例：PKサンダー"
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
                  <PlayerAvatar avatarUrl={player.avatarUrl} displayName={player.displayName} />
                  <span className="profile-member-name">
                    <strong>{player.displayName}</strong>
                    <small>{player.hasProfileAccess ? "本人端末 設定済み" : "本人端末 未設定"}</small>
                  </span>
                  <Form className="profile-claim-issue-form" method="post">
                    <input name="intent" type="hidden" value="issue-profile-claim" />
                    <input name="groupPlayerId" type="hidden" value={player.id} />
                    <button
                      aria-label={`${player.displayName}さんの本人用リンクを${player.hasProfileAccess ? "再発行" : "発行"}`}
                      className="profile-claim-issue-button"
                      disabled={isSubmitting}
                      title={player.hasProfileAccess ? "本人用リンクを再発行" : "本人用リンクを発行"}
                      type="submit"
                    >
                      {isSubmitting &&
                      submittingIntent === "issue-profile-claim" &&
                      navigation.formData?.get("groupPlayerId") === player.id
                        ? <span aria-hidden="true" className="profile-claim-issue-loading">…</span>
                        : <ProfileClaimLinkIcon />}
                    </button>
                  </Form>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function ProfileClaimLinkIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M10 13a5 5 0 0 0 7.1.1l2-2A5 5 0 0 0 12 4l-1.1 1.1" />
      <path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1" />
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

function formatExpiry(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));
}

export function headers() {
  return {
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
  };
}
