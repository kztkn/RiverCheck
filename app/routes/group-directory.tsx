import { Form, Link, redirect, useNavigation } from "react-router";
import { GroupSiteHeader } from "~/components/site-menu";
import {
  createGroup,
  getGroupDirectory,
  readCreateGroupForm,
} from "@server/services/group-service.server";
import {
  getAuthenticatedPlayerProfile,
} from "@server/services/player-profile-service.server";
import {
  isOrganizerAuthenticated,
  requireOrganizer,
} from "@server/services/organizer-auth.server";
import type { Route } from "./+types/group-directory";

export async function loader({ request, params }: Route.LoaderArgs) {
  const [profileOverview, organizer] = await Promise.all([
    getAuthenticatedPlayerProfile(request, params.groupCode),
    isOrganizerAuthenticated(request),
  ]);
  const directory = await getGroupDirectory(
    params.groupCode,
    profileOverview?.profile?.playerId ?? null,
    organizer,
  );
  if (!directory) throw new Response("Group not found", { status: 404 });
  return {
    ...directory,
    organizer,
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  await requireOrganizer(request, params.groupCode);
  const formData = await request.formData();
  const intent = readString(formData, "intent");
  if (intent !== "create-group") {
    throw new Response("Unknown action", { status: 400 });
  }

  const profileOverview = await getAuthenticatedPlayerProfile(
    request,
    params.groupCode,
  );
  const result = await createGroup(
    readCreateGroupForm(formData),
    profileOverview?.profile?.playerId ?? null,
  );
  if (!result.ok) return result;
  return redirect(`/g/${result.group.publicCode}/manage?notice=group-created`);
}

export default function GroupDirectory({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const navigation = useNavigation();
  const isCreating =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "create-group";
  const values = actionData?.ok === false
    ? actionData.values
    : { name: "", publicCode: "" };
  const errors = actionData?.ok === false ? actionData.errors : {};
  const sortedGroups = [...loaderData.groups].sort((left, right) => {
    if (left.id === loaderData.currentGroup.id) return -1;
    if (right.id === loaderData.currentGroup.id) return 1;
    return left.name.localeCompare(right.name, "ja");
  });

  return (
    <main className="page-shell group-directory-page">
      <GroupSiteHeader
        groupCode={loaderData.currentGroup.publicCode}
        organizer={loaderData.organizer}
      />

      <section className="form-intro group-directory-intro">
        <p className="eyebrow">GROUPS</p>
        <h1>グループを切り替える</h1>
        <p>
          プロフィールは共通のまま、開催・ランキング・実績はグループごとに分かれます。
        </p>
      </section>

      <section className="group-directory-list" aria-labelledby="group-list-heading">
        <div className="group-directory-heading">
          <h2 id="group-list-heading">
            {loaderData.organizer ? "グループ一覧" : "参加中のグループ"}
          </h2>
          <span className="count-badge">{sortedGroups.length}件</span>
        </div>
        <div className="group-directory-rows">
          {sortedGroups.map((group) => {
            const current = group.id === loaderData.currentGroup.id;
            return (
              <Link
                aria-current={current ? "page" : undefined}
                className={`group-directory-row${current ? " is-current" : ""}`}
                key={group.id}
                to={`/g/${group.publicCode}`}
              >
                <span className="group-directory-row-copy">
                  <strong>{group.name}</strong>
                  <small>/g/{group.publicCode}</small>
                </span>
                {current ? (
                  <span className="group-directory-current">現在</span>
                ) : (
                  <span aria-hidden="true" className="group-directory-arrow">→</span>
                )}
              </Link>
            );
          })}
        </div>
      </section>

      {loaderData.organizer ? (
        <details
          className="group-create-disclosure"
          open={actionData?.ok === false || undefined}
        >
          <summary>
            <span>新しいグループを作成</span>
            <span aria-hidden="true">＋</span>
          </summary>
          <Form className="group-create-form" method="post" noValidate>
            <input name="intent" type="hidden" value="create-group" />
            <div className="group-create-copy">
              <p>
                新しいコミュニティとして戦績と実績を0から始めます。プロフィールは既存のものを再利用できます。
              </p>
              <p>
                この端末でプレイヤーとしてログイン中なら、自分のプロフィールは作成時に自動で追加されます。
              </p>
            </div>
            <label className="field">
              <span className="field-label">グループ名</span>
              <input
                aria-invalid={Boolean(errors.name)}
                defaultValue={values.name}
                maxLength={60}
                name="name"
                placeholder="例：ボドゲ会"
                required
              />
              {errors.name ? <span className="field-error">{errors.name}</span> : null}
            </label>
            <label className="field">
              <span className="field-label">URL用コード</span>
              <input
                aria-invalid={Boolean(errors.publicCode)}
                autoCapitalize="none"
                autoCorrect="off"
                defaultValue={values.publicCode}
                maxLength={48}
                name="publicCode"
                placeholder="例：boardgame"
                required
                spellCheck={false}
              />
              <span className="field-hint">
                半角英小文字・数字・ハイフン。URLは /g/boardgame のようになります。
              </span>
              {errors.publicCode ? (
                <span className="field-error">{errors.publicCode}</span>
              ) : null}
            </label>
            <div className="group-create-actions">
              <button
                className="button button-primary"
                disabled={isCreating}
                type="submit"
              >
                {isCreating ? "作成中…" : "グループを作成"}
              </button>
            </div>
          </Form>
        </details>
      ) : null}
    </main>
  );
}

function readString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export function headers() {
  return {
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
  };
}
