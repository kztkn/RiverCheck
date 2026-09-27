import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  IconChevronRight,
  IconPlayerPause,
  IconPlayerPlay,
  IconRefresh,
  IconX,
} from "@tabler/icons-react";
import { Link } from "react-router";
import { AchievementIcon } from "~/components/achievement-icon";
import { PlayerAvatar } from "~/components/player-avatar";
import { buildPlayerAvatarUrl } from "@domain/player-profile/build-player-avatar-url";
import { formatSignedBbValue } from "@domain/score/bb-score";
import { getAuthenticatedPlayerProfile } from "@server/services/player-profile-service.server";
import { getYearRecap } from "@server/services/year-recap-service.server";
import type {
  YearRecapPlayerHighlight,
  YearRecapStreakKind,
  YearRecapSummary,
} from "@shared-types/year-recap";
import type { Route } from "./+types/year-recap";

const RECAP_YEAR = 2026;
const AUTO_ADVANCE_MS = 7_000;

export function meta({ params }: Route.MetaArgs) {
  return [
    { title: `${RECAP_YEAR} RECAP | RiverCheck` },
    { name: "robots", content: "noindex, nofollow" },
    {
      name: "description",
      content: `${params.groupCode}で過ごした${RECAP_YEAR}年のポーカーを振り返ります。`,
    },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const overview = await getAuthenticatedPlayerProfile(request, params.groupCode);
  if (!overview) throw new Response("Group not found", { status: 404 });
  if (!overview.profile) throw new Response("Forbidden", { status: 403 });

  return {
    group: {
      name: overview.group.name,
      publicCode: overview.group.publicCode,
    },
    recap: await getYearRecap(
      overview.group.id,
      overview.profile,
      RECAP_YEAR,
    ),
  };
}

export default function YearRecap({ loaderData }: Route.ComponentProps) {
  const slides = useMemo(
    () => buildSlides(loaderData.recap, loaderData.group.publicCode),
    [loaderData.group.publicCode, loaderData.recap],
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const activeSlide = slides[activeIndex];
  const isLastSlide = activeIndex === slides.length - 1;

  useEffect(() => {
    if (!isPlaying || isLastSlide) return;
    const timer = window.setTimeout(() => {
      setActiveIndex((current) => Math.min(current + 1, slides.length - 1));
    }, AUTO_ADVANCE_MS);
    return () => window.clearTimeout(timer);
  }, [activeIndex, isLastSlide, isPlaying, slides.length]);

  useEffect(() => {
    if (isLastSlide) setIsPlaying(false);
  }, [isLastSlide]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowRight") {
        setActiveIndex((current) => Math.min(current + 1, slides.length - 1));
      }
      if (event.key === "ArrowLeft") {
        setActiveIndex((current) => Math.max(current - 1, 0));
      }
      if (event.key === " ") {
        event.preventDefault();
        setIsPlaying((current) => !current);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [slides.length]);

  function startRecap() {
    setActiveIndex(Math.min(1, slides.length - 1));
    setIsPlaying(true);
  }

  function restartRecap() {
    setActiveIndex(0);
    setIsPlaying(false);
  }

  function showPreviousSlide() {
    setActiveIndex((current) => Math.max(current - 1, 0));
  }

  function showNextSlide() {
    if (activeIndex === 0) setIsPlaying(true);
    setActiveIndex((current) => Math.min(current + 1, slides.length - 1));
  }

  return (
    <main className={`year-recap theme-${activeSlide.theme}`}>
      <div className="year-recap-ambient" aria-hidden="true" />
      <header className="year-recap-toolbar">
        <div className="year-recap-progress" aria-label="年間まとめの進行状況">
          {slides.map((slide, index) => (
            <button
              aria-label={`${index + 1}枚目へ移動`}
              className={`${index < activeIndex ? "is-complete" : ""}${
                index === activeIndex ? " is-active" : ""
              }${index === activeIndex && isPlaying ? " is-playing" : ""}`}
              key={slide.key}
              onClick={() => setActiveIndex(index)}
              type="button"
            >
              <span />
            </button>
          ))}
        </div>
        <div className="year-recap-toolbar-actions">
          <button
            aria-label={isPlaying ? "自動再生を一時停止" : "自動再生を再開"}
            className="year-recap-icon-button"
            onClick={() => setIsPlaying((current) => !current)}
            type="button"
          >
            {isPlaying ? <IconPlayerPause aria-hidden="true" /> : <IconPlayerPlay aria-hidden="true" />}
          </button>
          <Link
            aria-label="年間まとめを閉じる"
            className="year-recap-icon-button"
            to={`/g/${loaderData.group.publicCode}`}
          >
            <IconX aria-hidden="true" />
          </Link>
        </div>
      </header>

      <section
        aria-live="polite"
        className="year-recap-stage"
        key={activeSlide.key}
      >
        {activeSlide.content}
        <button
          aria-label="前へ"
          className="year-recap-tap-zone is-previous"
          disabled={activeIndex === 0}
          onClick={showPreviousSlide}
          type="button"
        />
        <button
          aria-label="次へ"
          className="year-recap-tap-zone is-next"
          disabled={isLastSlide}
          onClick={showNextSlide}
          type="button"
        />
      </section>

      <footer className="year-recap-controls">
        {activeIndex === 0 ? (
          <button className="year-recap-start" onClick={startRecap} type="button">
            一年を振り返る
            <IconChevronRight aria-hidden="true" />
          </button>
        ) : isLastSlide ? (
          <button className="year-recap-start" onClick={restartRecap} type="button">
            もう一度見る
            <IconRefresh aria-hidden="true" />
          </button>
        ) : (
          <span className="year-recap-step-count">
            {activeIndex + 1} / {slides.length}
          </span>
        )}
      </footer>
    </main>
  );
}

interface RecapSlide {
  key: string;
  theme: "forest" | "gold" | "mint" | "violet" | "ember";
  content: ReactNode;
}

export function buildSlides(
  recap: YearRecapSummary,
  groupCode: string,
): RecapSlide[] {
  const { group, player } = recap;
  const playerAvatarUrl = buildPlayerAvatarUrl({
    avatarUpdatedAt: player.avatarUpdatedAt,
    groupCode,
    groupPlayerId: player.groupPlayerId,
  });
  const slides: RecapSlide[] = [
    {
      key: "cover",
      theme: "forest",
      content: (
        <RecapFrame eyebrow="RIVERCHECK YEAR IN REVIEW">
          <PlayerAvatar
            avatarUrl={playerAvatarUrl}
            className="year-recap-cover-avatar"
            displayName={player.displayName}
          />
          <p className="year-recap-year">{recap.year}</p>
          <h1>{player.displayName}の<br />ポーカーイヤー</h1>
          <p className="year-recap-lead">同じテーブルで過ごした一年を、数字と記憶で振り返ろう。</p>
        </RecapFrame>
      ),
    },
  ];

  if (group.gamesPlayed === 0) {
    slides.push({
      key: "empty",
      theme: "gold",
      content: (
        <RecapFrame eyebrow="THE FIRST HAND AWAITS">
          <p className="year-recap-kicker">{recap.year}</p>
          <h2>今年の確定結果は<br />まだありません</h2>
          <p className="year-recap-lead">最初の開催が確定すると、ここから一年の物語が始まります。</p>
        </RecapFrame>
      ),
    });
  } else {
    slides.push(
      {
        key: "table",
        theme: "mint",
        content: (
          <RecapFrame eyebrow="OUR TABLE">
            <p className="year-recap-kicker">みんなで囲んだテーブル</p>
            <BigNumber value={group.gamesPlayed} suffix="開催" />
            <div className="year-recap-metric-row">
              <Metric label="のべ参加" value={`${group.totalEntries}人`} />
              <Metric label="参加プレイヤー" value={`${group.uniquePlayers}人`} />
              <Metric label="リバイ" value={`${group.totalRebuys}回`} />
            </div>
          </RecapFrame>
        ),
      },
      {
        key: "player",
        theme: "gold",
        content: (
          <RecapFrame eyebrow="YOUR YEAR">
            <p className="year-recap-kicker">あなたが参加したのは</p>
            <BigNumber value={player.gamesPlayed} suffix="回" />
            <p className="year-recap-callout">開催日の {formatPercent(player.attendanceRate)}% を一緒に過ごしました</p>
            <div className="year-recap-metric-row is-two">
              <Metric label="優勝" value={`${player.wins}回`} />
              <Metric label="TOP 3" value={`${player.topThreeFinishes}回`} />
            </div>
          </RecapFrame>
        ),
      },
    );

    if (player.metPlayers.length > 0) {
      slides.push({
        key: "met-players",
        theme: "violet",
        content: (
          <RecapFrame eyebrow="PLAYERS WE MET">
            <p className="year-recap-kicker">今年出会ったプレイヤー</p>
            <BigNumber value={player.metPlayers.length} suffix="人" />
            <RecapPeople
              groupCode={groupCode}
              people={player.metPlayers}
              valueLabel={(value) => `${value}回同卓`}
            />
          </RecapFrame>
        ),
      });
    }

    slides.push({
      key: "score",
      theme: player.totalNetBb >= 0 ? "mint" : "violet",
      content: (
        <RecapFrame eyebrow="TOTAL PROFIT">
          <p className="year-recap-kicker">一年をBBで振り返ると</p>
          <p className={`year-recap-profit ${player.totalNetBb >= 0 ? "is-positive" : "is-negative"}`}>
            {formatSignedBbValue(player.totalNetBb)}
          </p>
          <p className="year-recap-lead">数字の上下も、すべて今年のテーブルの記録です。</p>
        </RecapFrame>
      ),
    });
  }

  if (player.longestStreak) {
    const copy = getStreakCopy(player.longestStreak.kind);
    slides.push({
      key: "longest-streak",
      theme: "gold",
      content: (
        <RecapFrame eyebrow="LONG STREAK">
          <p className="year-recap-kicker">今年のロングストリーク</p>
          <BigNumber value={player.longestStreak.count} suffix="開催" />
          <p className="year-recap-callout">
            {player.longestStreak.count}開催{copy.label}
          </p>
          <p className="year-recap-lead">{copy.description}</p>
        </RecapFrame>
      ),
    });
  }

  if (player.bestGame) {
    slides.push({
      key: "best-game",
      theme: "ember",
      content: (
        <RecapFrame eyebrow="YOUR BIG NIGHT">
          <p className="year-recap-kicker">今年いちばん伸ばした夜</p>
          <p className="year-recap-profit is-positive">{formatSignedBbValue(player.bestGame.netBb)}</p>
          <h2 className="year-recap-game-title">{player.bestGame.gameTitle}</h2>
          <p className="year-recap-lead">
            {formatRecapDate(player.bestGame.playedAt)} ・ {player.bestGame.rank}位
          </p>
        </RecapFrame>
      ),
    });
  }

  if (player.podiumMates.length > 0) {
    slides.push({
      key: "podium-mates",
      theme: "violet",
      content: (
        <RecapFrame eyebrow="PODIUM MATES">
          <p className="year-recap-kicker">表彰台メイト</p>
          <h2>一緒にTOP 3へ</h2>
          <RecapPeople
            groupCode={groupCode}
            people={player.podiumMates}
            valueLabel={(value) => `${value}回`}
          />
          <p className="year-recap-lead">同じ開催で表彰台に並んだ回数が最も多い仲間です。</p>
        </RecapFrame>
      ),
    });
  }

  if (
    recap.stories.postsCreated > 0 ||
    recap.stories.reactionsReceived > 0 ||
    recap.stories.reactedPostCount > 0
  ) {
    slides.push({
      key: "stories",
      theme: "forest",
      content: (
        <RecapFrame eyebrow="TABLE STORIES">
          <p className="year-recap-kicker">テーブルの外にも残った記憶</p>
          <div className="year-recap-story-grid">
            <Metric label="投稿した思い出" value={`${recap.stories.postsCreated}件`} />
            <Metric label="届いたリアクション" value={`${recap.stories.reactionsReceived}個`} />
            <Metric label="反応した投稿" value={`${recap.stories.reactedPostCount}件`} />
          </div>
        </RecapFrame>
      ),
    });
  }

  if (recap.achievements.length > 0) {
    slides.push({
      key: "achievements",
      theme: "gold",
      content: (
        <RecapFrame eyebrow="ACHIEVEMENTS UNLOCKED">
          <p className="year-recap-kicker">今年手に入れた称号</p>
          <BigNumber value={recap.achievements.length} suffix="個" />
          <div className="year-recap-achievements">
            {recap.achievements.slice(0, 4).map((achievement) => (
              <span key={achievement.id}>
                <AchievementIcon iconKey={achievement.iconKey} />
                <strong>{achievement.name}</strong>
              </span>
            ))}
          </div>
        </RecapFrame>
      ),
    });
  }

  if (group.mostWinsPlayers.length > 0) {
    slides.push({
      key: "most-wins",
      theme: "mint",
      content: (
        <RecapFrame eyebrow="MOST WINS">
          <p className="year-recap-kicker">年間最多優勝</p>
          <h2>今年の<br />チャンピオン</h2>
          <RecapPeople
            groupCode={groupCode}
            people={group.mostWinsPlayers}
            valueLabel={(value) => `${value}回優勝`}
          />
        </RecapFrame>
      ),
    });
  }

  slides.push({
    key: "finale",
    theme: "forest",
    content: (
      <RecapFrame eyebrow={`${recap.year} · RIVERCHECK`}>
        <p className="year-recap-suit" aria-hidden="true">♠</p>
        <h2>今年も、<br />同じテーブルで。</h2>
        <p className="year-recap-lead">勝った夜も、負けた夜も、集まったことが一番の記録。</p>
        {player.gamesPlayed > 0 ? (
          <p className="year-recap-final-stat">
            {player.gamesPlayed}回参加 ・ {formatSignedBbValue(player.totalNetBb)}
          </p>
        ) : null}
      </RecapFrame>
    ),
  });

  return slides;
}

function RecapFrame({ eyebrow, children }: { eyebrow: string; children: ReactNode }) {
  return (
    <div className="year-recap-frame">
      <p className="year-recap-eyebrow">{eyebrow}</p>
      <div className="year-recap-content">{children}</div>
    </div>
  );
}

function BigNumber({ value, suffix }: { value: number; suffix: string }) {
  return (
    <p className="year-recap-big-number">
      <strong>{value.toLocaleString("ja-JP")}</strong>
      <span>{suffix}</span>
    </p>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <span className="year-recap-metric">
      <small>{label}</small>
      <strong>{value}</strong>
    </span>
  );
}

function RecapPeople({
  groupCode,
  people,
  valueLabel,
}: {
  groupCode: string;
  people: YearRecapPlayerHighlight[];
  valueLabel: (value: number) => string;
}) {
  return (
    <div className={`year-recap-people${people.length > 4 ? " is-crowd" : ""}`}>
      {people.map((person) => (
        <span className="year-recap-person" key={person.groupPlayerId}>
          <PlayerAvatar
            avatarUrl={buildPlayerAvatarUrl({
              avatarUpdatedAt: person.avatarUpdatedAt,
              groupCode,
              groupPlayerId: person.groupPlayerId,
            })}
            className="year-recap-person-avatar"
            displayName={person.displayName}
          />
          <strong>{person.displayName}</strong>
          <small>{valueLabel(person.value)}</small>
        </span>
      ))}
    </div>
  );
}

function getStreakCopy(kind: YearRecapStreakKind) {
  const copy: Record<YearRecapStreakKind, { label: string; description: string }> = {
    positive: {
      label: "連続プラス",
      description: "参加した開催で、プラス収支を続けた最長記録です。",
    },
    "top-three": {
      label: "連続TOP 3",
      description: "参加した開催で、TOP 3入りを続けた最長記録です。",
    },
    attendance: {
      label: "連続参加",
      description: "グループの開催へ、欠席せず参加した最長記録です。",
    },
  };
  return copy[kind];
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 }).format(value);
}

function formatRecapDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "long",
    day: "numeric",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));
}
