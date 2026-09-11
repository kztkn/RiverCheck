import { Form, Link, redirect, useNavigation } from "react-router";
import { GroupSiteHeader } from "~/components/site-menu";
import { PlayerChoiceList } from "~/components/player-choice-list";
import { PLAYER_DISPLAY_NAME_MAX_LENGTH } from "@domain/player-profile/validate-player-profile";
import { getGroupEntry, enterGroup } from "@server/services/group-entry-service.server";
import { createPlayerProfileCookie } from "@server/services/player-profile-session.server";
import type { Route } from "./+types/group-join";

export async function loader({ request, params }: Route.LoaderArgs) {
  const entry = await getGroupEntry(request, params.groupCode);
  if (!entry) throw new Response("Group not found", { status: 404 });
  return entry;
}

export async function action({ request, params }: Route.ActionArgs) {
  const form = await request.formData();
  const read = (name: string) => {
    const value = form.get(name);
    return typeof value === "string" ? value : "";
  };
  const input = {
    intent: read("intent"),
    displayName: read("displayName"),
    groupPlayerId: read("groupPlayerId"),
  };
  const result = await enterGroup(request, params.groupCode, input);
  if (!result.ok) return { ...result, displayName: input.displayName };
  return redirect(`/g/${params.groupCode}`, {
    status: 303,
    headers: result.sessionToken
      ? { "Set-Cookie": createPlayerProfileCookie(request, result.sessionToken) }
      : undefined,
  });
}

export default function GroupJoin({ loaderData, actionData }: Route.ComponentProps) {
  const isSubmitting = useNavigation().state !== "idle";
  const basePath = `/g/${loaderData.group.publicCode}`;
  return (
    <main className="page-shell form-page">
      <GroupSiteHeader groupCode={loaderData.group.publicCode} hideNavigation={!loaderData.profile} />
      <section className="form-intro">
        <p className="eyebrow">WELCOME TO THE GROUP</p>
        <h1>{loaderData.group.name}</h1>
        <p>自分のプロフィールで、みんなの戦績や次の開催をチェック。</p>
      </section>
      {actionData?.ok === false ? <p className="error-notice" role="alert">{actionData.error}</p> : null}
      {loaderData.profile ? (
        <section className="participant-panel">
          <h2>{loaderData.profile.displayName}としてログイン中</h2>
          <Link className="button button-primary" reloadDocument to={basePath}>グループへ進む</Link>
        </section>
      ) : loaderData.identity ? (
        <section className="participant-panel">
          <h2>{loaderData.identity.displayName}として参加</h2>
          <p>今のプロフィールのまま、このグループに参加できます。</p>
          <Form method="post" reloadDocument>
            <input type="hidden" name="intent" value="join-self" />
            <button className="button button-primary" disabled={isSubmitting} type="submit">
              {isSubmitting ? "参加中…" : "このグループに参加する"}
            </button>
          </Form>
        </section>
      ) : (
        <div className="player-selection">
          <section className="player-selection-primary">
            <h2>自分の名前でログイン</h2>
            <p className="muted-copy">名前を選ぶと、この端末では次回から自分として開きます。</p>
            {loaderData.players.length ? (
              <PlayerChoiceList
                actionLabel="ログイン"
                confirmBeforeSubmit
                confirmationKind="login"
                intent="select-existing"
                isSubmitting={isSubmitting}
                players={loaderData.players}
                reloadDocument
              />
            ) : <p className="muted-copy">まだ登録されているメンバーはいません。</p>}
          </section>
          <section className="player-selection-create">
            <h2>はじめての方</h2>
            <p className="muted-copy">一覧に名前がなければ、新しく登録してください。</p>
            <Form className="new-player-form" method="post" reloadDocument>
              <input type="hidden" name="intent" value="create-player" />
              <label className="field">
                <span className="field-label">表示名</span>
                <input name="displayName" defaultValue={actionData?.displayName ?? ""} maxLength={PLAYER_DISPLAY_NAME_MAX_LENGTH} required />
                <span className="field-hint">最大{PLAYER_DISPLAY_NAME_MAX_LENGTH}文字</span>
              </label>
              <button className="button button-primary" disabled={isSubmitting} type="submit">
                {isSubmitting ? "登録中…" : "この名前で登録"}
              </button>
            </Form>
          </section>
        </div>
      )}
    </main>
  );
}

export function headers() {
  return { "Cache-Control": "no-store" };
}
