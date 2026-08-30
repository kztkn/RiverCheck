import { GroupSiteHeader } from "~/components/site-menu";
import { AppToast } from "~/components/app-toast";
import { orderActiveGamesBySchedule } from "@domain/game/order-active-games";
import {
  IconPlus,
  IconSettings,
  IconUsers,
} from "@tabler/icons-react";
import { useEffect } from "react";
import { Form, Link, redirect, useNavigation } from "react-router";
import { getGroupOverview } from "@server/services/group-service.server";
import { rescheduleOpenGameForGroup } from "@server/services/game-schedule-service.server";
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

export async function action({ request, params }: Route.ActionArgs) {
  await requireOrganizer(request, params.groupCode);
  const formData = await request.formData();
  const intent = readString(formData, "intent");
  if (intent !== "reschedule-game") {
    throw new Response("Unknown action", { status: 400 });
  }

  const gameId = readString(formData, "gameId");
  const playedAt = readString(formData, "playedAt");
  try {
    const result = await rescheduleOpenGameForGroup(
      params.groupCode,
      gameId,
      playedAt,
    );
    if (!result.ok) {
      return {
        ...result,
        intent: "reschedule-game" as const,
        gameId,
      };
    }
  } catch (error) {
    console.error("Failed to reschedule open game", error);
    return {
      ok: false as const,
      intent: "reschedule-game" as const,
      gameId,
      playedAt,
      error: "開催日を変更できませんでした。画面を更新してもう一度お試しください。",
    };
  }

  return redirect(`/g/${params.groupCode}/manage?notice=game-rescheduled`, {
    status: 303,
  });
}

export default function GroupManage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { group, games } = loaderData;
  const navigation = useNavigation();
  const activeGames = orderActiveGamesBySchedule(games);
  const pastGames = games.filter((game) => game.status === "finalized");
  const scheduleAction =
    actionData?.ok === false && actionData.intent === "reschedule-game"
      ? actionData
      : null;

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
            : loaderData.notice === "game-rescheduled"
              ? "開催日を変更しました。"
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
              <div className="organizer-game-entry" key={game.id}>
                <ManageGameRow game={game} groupCode={group.publicCode} />
                <details
                  className="organizer-game-schedule"
                  open={scheduleAction?.gameId === game.id || undefined}
                >
                  <summary>開催日を変更</summary>
                  <Form className="organizer-game-schedule-form" method="post">
                    <input name="intent" type="hidden" value="reschedule-game" />
                    <input name="gameId" type="hidden" value={game.id} />
                    <label className="field">
                      <span className="field-label">開催日</span>
                      <input
                        aria-invalid={
                          scheduleAction?.gameId === game.id ? true : undefined
                        }
                        defaultValue={
                          scheduleAction?.gameId === game.id
                            ? scheduleAction.playedAt
                            : toDateInputValue(game.playedAt)
                        }
                        name="playedAt"
                        required
                        type="date"
                      />
                    </label>
                    {scheduleAction?.gameId === game.id ? (
                      <p className="field-error" role="alert">
                        {scheduleAction.error}
                      </p>
                    ) : null}
                    <button
                      className="button button-secondary button-small"
                      disabled={
                        navigation.state === "submitting" &&
                        navigation.formData?.get("intent") === "reschedule-game" &&
                        navigation.formData?.get("gameId") === game.id
                      }
                      type="submit"
                    >
                      {navigation.state === "submitting" &&
                      navigation.formData?.get("intent") === "reschedule-game" &&
                      navigation.formData?.get("gameId") === game.id
                        ? "変更中…"
                        : "日付を保存"}
                    </button>
                  </Form>
                </details>
              </div>
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

function toDateInputValue(playedAt: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Tokyo",
  }).formatToParts(new Date(playedAt));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function readString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}
