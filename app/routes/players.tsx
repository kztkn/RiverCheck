import { Form, Link, redirect, useNavigation } from "react-router";
import {
  addPlayerForGroup,
  getPlayerManagement,
  readAddPlayerForm,
} from "@server/services/player-service.server";
import type { Route } from "./+types/players";

export async function loader({ request, params }: Route.LoaderArgs) {
  const management = await getPlayerManagement(params.groupCode);
  if (!management) throw new Response("Group not found", { status: 404 });

  return {
    ...management,
    added: new URL(request.url).searchParams.has("added"),
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const values = readAddPlayerForm(await request.formData());
  const result = await addPlayerForGroup(params.groupCode, values);
  if (!result.ok) return result;
  return redirect(`/g/${params.groupCode}/players?added=1`);
}

export default function Players({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const errors = actionData?.ok === false ? actionData.errors : {};
  const displayName =
    actionData?.ok === false ? actionData.values.displayName : "";

  return (
    <main className="page-shell form-page">
      <header className="site-header">
        <Link className="brand" to={`/g/${loaderData.group.publicCode}/manage`}>
          <span className="brand-mark">RC</span>
          <span>RiverCheck</span>
        </Link>
        <Link
          className="text-link"
          to={`/g/${loaderData.group.publicCode}/manage`}
        >
          ← 主催者画面
        </Link>
      </header>

      <section className="form-intro">
        <p className="eyebrow">MEMBERS</p>
        <h1>メンバー管理</h1>
        <p>よく参加するメンバーを、必要に応じて先に登録できます。</p>
      </section>

      {loaderData.added ? (
        <p className="success-notice" role="status">
          メンバーを追加しました。
        </p>
      ) : null}

      <div className="management-grid">
        <Form className="compact-form" method="post" noValidate>
          <div className="section-heading compact-heading">
            <div>
              <p className="eyebrow">ADD MEMBER</p>
              <h2>新しいメンバー</h2>
            </div>
          </div>

          <label className="field" htmlFor="displayName">
            <span className="field-label">表示名</span>
            <span className="input-wrap">
              <input
                aria-describedby={
                  errors.displayName ? "displayName-error" : undefined
                }
                aria-invalid={Boolean(errors.displayName)}
                defaultValue={displayName}
                id="displayName"
                maxLength={40}
                name="displayName"
                placeholder="例：たろう"
                required
              />
            </span>
            {errors.displayName ? (
              <span className="field-error" id="displayName-error">
                {errors.displayName}
              </span>
            ) : null}
          </label>

          <button
            className="button button-primary"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "追加中…" : "メンバーを追加"}
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
            <div className="mini-empty">
              <p>まだメンバーはいません。</p>
            </div>
          ) : (
            <ul className="member-list">
              {loaderData.players.map((player, index) => (
                <li key={player.id}>
                  <span className="member-avatar" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <strong>{player.displayName}</strong>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
