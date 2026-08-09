import { GroupSiteHeader } from "~/components/site-menu";
import { Link, redirect, useNavigation } from "react-router";
import { PayPayLinkEditor } from "~/components/paypay-link-editor";
import { getGroupOverview } from "@server/services/group-service.server";
import { findGroupByPublicCode } from "@server/repositories/group-repository.server";
import { saveGroupPayPayRecipientLink } from "@server/services/group-paypay-service.server";
import { requireOrganizer } from "@server/services/organizer-auth.server";
import type { Route } from "./+types/group-manage";

const statusLabels = {
  draft: "準備中",
  open: "受付中",
  finalized: "確定済み",
} as const;

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireOrganizer(request, params.groupCode);
  const overview = await getGroupOverview(params.groupCode);
  if (!overview) throw new Response("Group not found", { status: 404 });
  return {
    ...overview,
    notice: new URL(request.url).searchParams.get("notice"),
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  await requireOrganizer(request, params.groupCode);
  const group = await findGroupByPublicCode(params.groupCode);
  if (!group) throw new Response("Group not found", { status: 404 });
  const formData = await request.formData();
  if (readString(formData, "intent") !== "save-paypay-link") {
    throw new Response("Unknown action", { status: 400 });
  }
  const result = await saveGroupPayPayRecipientLink(
    group.id,
    readString(formData, "payPayRecipientLink"),
  );
  return result.ok
    ? redirect(`/g/${params.groupCode}/manage?notice=paypay-saved`, {
        status: 303,
      })
    : { ...result, intent: "save-paypay-link" as const };
}

export default function GroupManage({ loaderData, actionData }: Route.ComponentProps) {
  const { group, games } = loaderData;
  const navigation = useNavigation();
  const payPayAction =
    actionData?.ok === false && actionData.intent === "save-paypay-link"
      ? actionData
      : null;
  const manageUrl = `/g/${group.publicCode}/manage`;
  const isPayPaySubmitting =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "save-paypay-link";

  return (
    <main className="page-shell">
      <GroupSiteHeader groupCode={group.publicCode} organizer />

      <section className="hero-card organizer-hero">
        <div>
          <h1>ORGANIZER HOME</h1>
          <p className="hero-copy">
            {group.name} の開催作成、参加状況、結果をここから管理します。
          </p>
        </div>
        <div className="hero-actions">
          <Link
            className="button button-secondary"
            to={`/g/${group.publicCode}/players`}
          >
            メンバー管理
          </Link>
          <Link
            className="button button-primary"
            to={`/g/${group.publicCode}/games/new`}
          >
            <span aria-hidden="true">＋</span>
            新しい会を作成
          </Link>
        </div>
      </section>

      {loaderData.notice === "paypay-saved" ? (
        <p className="success-notice">PayPay受取リンクを保存しました。</p>
      ) : null}

      <PayPayLinkEditor
        actionUrl={manageUrl}
        cancelUrl={manageUrl}
        error={payPayAction?.error ?? null}
        isSubmitting={isPayPaySubmitting}
        link={group.payPayRecipientLink}
        registeredAt={group.payPayLinkRegisteredAt}
        value={payPayAction?.value ?? null}
      />

      <section
        className="content-section"
        aria-labelledby="manage-games-heading"
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">MANAGE GAMES</p>
            <h2 id="manage-games-heading">開催管理</h2>
          </div>
          <span className="count-badge">{games.length}件</span>
        </div>

        {games.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon" aria-hidden="true">
              ♠
            </div>
            <h3>まだ開催はありません</h3>
            <p>「新しい会を作成」から最初の開催を作ってください。</p>
          </div>
        ) : (
          <div className="game-list">
            {games.map((game) => (
              <article className="game-card" key={game.id}>
                <Link
                  className="game-card-main"
                  to={
                    game.status === "finalized"
                      ? `/g/${group.publicCode}/games/${game.id}/admin/edit`
                      : `/g/${group.publicCode}/games/${game.id}/admin`
                  }
                >
                  <span className={`status status-${game.status}`}>
                    {statusLabels[game.status]}
                  </span>
                  <h3>{game.title}</h3>
                  <time dateTime={game.playedAt}>
                    {new Intl.DateTimeFormat("ja-JP", {
                      dateStyle: "long",
                      timeZone: "Asia/Tokyo",
                    }).format(new Date(game.playedAt))}
                  </time>
                </Link>
                <div className="game-card-actions">
                  <Link
                    className="card-action"
                    to={
                      game.status === "finalized"
                        ? `/g/${group.publicCode}/games/${game.id}/admin/edit`
                        : `/g/${group.publicCode}/games/${game.id}/admin`
                    }
                  >
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function readString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}
