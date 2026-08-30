import { GroupSiteHeader } from "~/components/site-menu";
import { AppToast } from "~/components/app-toast";
import { orderActiveGamesBySchedule } from "@domain/game/order-active-games";
import {
  IconPlus,
  IconSettings,
  IconUsers,
} from "@tabler/icons-react";
import { useEffect } from "react";
import { Link } from "react-router";
import { getGroupOverview } from "@server/services/group-service.server";
import { requireOrganizer } from "@server/services/organizer-auth.server";
import type { Route } from "./+types/group-manage";
import { buildSettlementPreviewDraftStorageKey } from "~/utils/settlement-preview-draft";

const statusLabels = {
  draft: "準備中",
  open: "受付中",
  finalized: "確定済み",
} as const;

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireOrganizer(request, params.groupCode);
  const overview = await getGroupOverview(params.groupCode);
  if (!overview) throw new Response("Group not found", { status: 404 });
  const url = new URL(request.url);
  return {
    ...overview,
    notice: url.searchParams.get("notice"),
    deletedGameId: url.searchParams.get("deletedGameId"),
  };
}

export default function GroupManage({ loaderData }: Route.ComponentProps) {
  const { group, games } = loaderData;
  const activeGames = orderActiveGamesBySchedule(games);
  const pastGames = games.filter((game) => game.status === "finalized");

  useEffect(() => {
    if (loaderData.notice !== "game-deleted" || !loaderData.deletedGameId) {
      return;
    }
    try {
      window.localStorage.removeItem(
        buildSettlementPreviewDraftStorageKey(
          group.publicCode,
          loaderData.deletedGameId,
        ),
      );
    } catch {
      // Deletion already succeeded; blocked local storage needs no recovery.
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("deletedGameId");
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, [
    group.publicCode,
    loaderData.deletedGameId,
    loaderData.notice,
  ]);

  return (
    <main className="page-shell organizer-home-page">
      <GroupSiteHeader groupCode={group.publicCode} organizer />

      <section className="organizer-home-intro">
        <p className="form-brand-label">ORGANIZER</p>
        <h1>開催管理</h1>
        <p>{group.name} のテーブルを準備し、進行を確認します。</p>
        <nav aria-label="グループ管理" className="organizer-home-tools">
          <Link
            className="organizer-home-tool"
            to={`/g/${group.publicCode}/players`}
          >
            <IconUsers aria-hidden="true" stroke={1.8} />
            メンバー管理
          </Link>
          <Link
            className="organizer-home-tool"
            to={`/g/${group.publicCode}/settings`}
          >
            <IconSettings aria-hidden="true" stroke={1.8} />
            グループ設定
          </Link>
        </nav>
      </section>

      <AppToast
        message={
          loaderData.notice === "game-deleted"
            ? "開催を削除しました。"
            : loaderData.notice === "group-created"
              ? "グループを作成しました。"
              : null
        }
        searchParam="notice"
      />

      <section
        className="organizer-game-section"
        aria-labelledby="manage-games-heading"
      >
        <div className="organizer-section-heading">
          <h2 id="manage-games-heading">開催予定</h2>
          <div className="section-heading-actions">
            <span className="home-section-count">{activeGames.length}件</span>
            <Link
              className="button button-primary organizer-new-game"
              to={`/g/${group.publicCode}/games/new`}
            >
              <IconPlus aria-hidden="true" stroke={2} />
              新しい会を作成
            </Link>
          </div>
        </div>

        {activeGames.length === 0 ? (
          <p className="organizer-game-empty">
            開催予定はありません。次の会を作成できます。
          </p>
        ) : (
          <div className="organizer-game-list">
            {activeGames.map((game) => (
              <ManageGameRow
                game={game}
                groupCode={group.publicCode}
                key={game.id}
              />
            ))}
          </div>
        )}
      </section>

      <section
        aria-labelledby="manage-history-heading"
        className="organizer-game-section organizer-history-section"
      >
        <div className="organizer-section-heading">
          <h2 id="manage-history-heading">過去の開催</h2>
          <span className="home-section-count">{pastGames.length}件</span>
        </div>
        {pastGames.length === 0 ? (
          <p className="organizer-game-empty">確定済みの開催はまだありません。</p>
        ) : (
          <div className="organizer-game-list">
            {pastGames.map((game) => (
              <ManageGameRow
                game={game}
                groupCode={group.publicCode}
                key={game.id}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function ManageGameRow({
  game,
  groupCode,
}: {
  game: Route.ComponentProps["loaderData"]["games"][number];
  groupCode: string;
}) {
  const isPast = game.status === "finalized";
  return (
    <Link
      className="organizer-game-row"
      to={
        isPast
          ? `/g/${groupCode}/games/${game.id}/admin/edit`
          : `/g/${groupCode}/games/${game.id}/admin`
      }
    >
      <time dateTime={game.playedAt}>{formatGameDate(game.playedAt)}</time>
      <span className="organizer-game-row-main">
        <strong>{game.title}</strong>
        <small>
          {statusLabels[game.status]} ・ 参加 {game.participantCount}人
          {isPast ? ` ・ 優勝 ${game.winnerName ?? "—"}` : ""}
        </small>
      </span>
      <span aria-hidden="true">→</span>
    </Link>
  );
}

function formatGameDate(playedAt: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    timeZone: "Asia/Tokyo",
  }).format(new Date(playedAt));
}
