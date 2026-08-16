import { Link, useRouteLoaderData } from "react-router";
import { GroupSiteHeader } from "~/components/site-menu";
import { getGroupOverview } from "@server/services/group-service.server";
import type { GameListItem } from "@shared-types/game";
import type { Route } from "./+types/group-top";

const statusLabels = {
  draft: "準備中",
  open: "受付中",
  finalized: "終了",
} as const;

export async function loader({ params }: Route.LoaderArgs) {
  const overview = await getGroupOverview(params.groupCode);
  if (!overview) throw new Response("Group not found", { status: 404 });
  return overview;
}

export default function GroupTop({ loaderData }: Route.ComponentProps) {
  const { group, games } = loaderData;
  const rootData = useRouteLoaderData("root") as
    | {
        authenticatedPlayerGroupPlayerId: string | null;
        isOrganizer: boolean;
      }
    | undefined;
  const isOrganizer = rootData?.isOrganizer ?? false;
  const playerStatsUrl = rootData?.authenticatedPlayerGroupPlayerId
    ? `stats/${rootData.authenticatedPlayerGroupPlayerId}`
    : "profile";

  const activeGames = games.filter((game) => game.status !== "finalized");
  const pastGames = games.filter((game) => game.status === "finalized");
  const primaryGame =
    activeGames.find((game) => game.status === "open") ?? activeGames[0];
  const otherActiveGames = primaryGame
    ? activeGames.filter((game) => game.id !== primaryGame.id)
    : [];

  return (
    <main className="page-shell group-home-page">
      <GroupSiteHeader groupCode={group.publicCode} />

      <section className="group-home-intro">
        <p className="group-home-brand">YOUR POKER TABLE</p>
        <h1>{group.name}</h1>
        <p>今日のテーブルへ。終わったゲームは、みんなの記録へ。</p>
      </section>

      <section
        aria-labelledby="current-game-heading"
        className="home-current-game"
      >
        <div className="home-section-heading">
          <div>
            <p className="home-section-kicker">OPEN TABLE</p>
            <h2 id="current-game-heading">受付中のゲーム</h2>
          </div>
          <span className="home-section-count">{activeGames.length}件</span>
        </div>

        {primaryGame ? (
          <>
            <article className="home-primary-game">
              <div className="home-primary-game-copy">
                <span className={`status status-${primaryGame.status}`}>
                  {statusLabels[primaryGame.status]}
                </span>
                <h3>{primaryGame.title}</h3>
                <div className="home-game-meta">
                  <time dateTime={primaryGame.playedAt}>
                    {formatGameDate(primaryGame.playedAt)}
                  </time>
                  <span>参加者 {primaryGame.participantCount}人</span>
                </div>
              </div>
              <Link
                className="button button-primary home-game-primary-action"
                to={buildGameUrl(primaryGame, isOrganizer, false)}
              >
                {isOrganizer
                  ? "開催管理を開く"
                  : primaryGame.status === "open"
                    ? "ゲーム画面へ"
                    : "受付状況を見る"}
                <span aria-hidden="true">→</span>
              </Link>
            </article>
            {otherActiveGames.length > 0 ? (
              <div
                aria-label="その他の受付中ゲーム"
                className="home-other-games"
              >
                {otherActiveGames.map((game) => (
                  <GameListRow
                    game={game}
                    isOrganizer={isOrganizer}
                    key={game.id}
                  />
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <div className="home-current-empty">
            <p>受付中のゲームはありません。</p>
            {getCreateGameUrl(0, isOrganizer, false) ? (
              <Link className="button button-secondary" to="games/new">
                新しい会を作成
              </Link>
            ) : null}
          </div>
        )}
      </section>

      <Link className="home-profile-link" to={playerStatsUrl}>
        <span>
          <small>PLAYER RECORD</small>
          <strong>プロフィールと戦績</strong>
          <span>損益・順位・MY HANDを振り返る</span>
        </span>
        <span aria-hidden="true">→</span>
      </Link>

      <PastGames games={pastGames} />

      <nav aria-label="その他のグループ情報" className="home-secondary-links">
        <Link to="stats">
          ランキングを見る <span aria-hidden="true">→</span>
        </Link>
        <Link to="about">
          RiverCheckについて <span aria-hidden="true">→</span>
        </Link>
      </nav>
    </main>
  );
}

function PastGames({ games }: { games: GameListItem[] }) {
  const visibleGames = games.slice(0, 3);
  const remainingGames = games.slice(3);
  return (
    <section aria-labelledby="past-games-heading" className="home-history">
      <div className="home-section-heading">
        <h2 id="past-games-heading">最近の開催</h2>
        <span className="home-section-count">{games.length}件</span>
      </div>
      {games.length === 0 ? (
        <p className="home-history-empty">過去の開催はまだありません。</p>
      ) : (
        <>
          <div className="home-game-list">
            {visibleGames.map((game) => (
              <GameListRow game={game} isPast key={game.id} />
            ))}
          </div>
          {remainingGames.length > 0 ? (
            <details className="home-history-more">
              <summary>過去の開催をすべて見る</summary>
              <div className="home-game-list">
                {remainingGames.map((game) => (
                  <GameListRow game={game} isPast key={game.id} />
                ))}
              </div>
            </details>
          ) : null}
        </>
      )}
    </section>
  );
}

function GameListRow({
  game,
  isPast = false,
  isOrganizer = false,
}: {
  game: GameListItem;
  isPast?: boolean;
  isOrganizer?: boolean;
}) {
  return (
    <Link
      className="home-game-row"
      to={buildGameUrl(game, isOrganizer, isPast)}
    >
      <time dateTime={game.playedAt}>{formatGameDateShort(game.playedAt)}</time>
      <span className="home-game-row-main">
        <strong>{game.title}</strong>
        <small>
          参加者 {game.participantCount}人
          {isPast ? ` ・ 優勝 ${game.winnerName ?? "—"}` : ""}
        </small>
      </span>
      <span aria-hidden="true" className="home-game-row-arrow">
        →
      </span>
    </Link>
  );
}

function formatGameDate(playedAt: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "long",
    timeZone: "Asia/Tokyo",
  }).format(new Date(playedAt));
}

function formatGameDateShort(playedAt: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    timeZone: "Asia/Tokyo",
  }).format(new Date(playedAt));
}

export function getCreateGameUrl(
  gameCount: number,
  isOrganizer: boolean,
  isPast: boolean,
): string | null {
  return gameCount === 0 && isOrganizer && !isPast
    ? "games/new"
    : null;
}

export function buildGameUrl(
  game: GameListItem,
  isOrganizer: boolean,
  isPast: boolean,
) {
  const suffix = isOrganizer && !isPast ? "/admin" : "";
  return `games/${game.id}${suffix}`;
}
