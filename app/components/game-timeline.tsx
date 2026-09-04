import { useEffect, useMemo, useState } from "react";
import { PlayerAvatar } from "./player-avatar";

interface RebuyTimelineEvent {
  id: string;
  type: "rebuy" | "repayment";
  recordedAt: string;
  groupPlayerId: string;
  displayName: string;
  avatarUrl: string | null;
}

interface SevenDeuceTimelineEvent {
  id: string;
  type: "seven_deuce";
  recordedAt: string;
  subject: {
    groupPlayerId: string;
    displayName: string;
    avatarUrl: string | null;
  } | null;
  players: [];
}

interface BombPotTimelineEvent {
  id: string;
  type: "bomb_pot";
  recordedAt: string;
  subject: null;
  players: [];
}

interface AllInTimelineEvent {
  id: string;
  type: "all_in";
  recordedAt: string;
  subject: null;
  players: Array<{
    groupPlayerId: string;
    displayName: string;
    isWinner: boolean;
  }>;
}

export type GameTimelineEventView =
  | RebuyTimelineEvent
  | SevenDeuceTimelineEvent
  | BombPotTimelineEvent
  | AllInTimelineEvent;

interface GameTimelineResponse {
  events: GameTimelineEventView[];
}

interface AttachedRebuy {
  allInId: string;
  event: RebuyTimelineEvent;
}

export function GameTimeline() {
  const [events, setEvents] = useState<GameTimelineEventView[]>([]);
  const timelinePath =
    typeof window === "undefined"
      ? null
      : buildGameTimelinePath(window.location.pathname);

  useEffect(() => {
    if (!timelinePath) return;
    const controller = new AbortController();
    setEvents([]);

    void fetch(timelinePath, {
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as GameTimelineResponse;
      })
      .then((data) => {
        if (data) setEvents(data.events);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setEvents([]);
      });

    return () => controller.abort();
  }, [timelinePath]);

  return <GameTimelineView events={events} />;
}

export function GameTimelineView({
  events,
}: {
  events: GameTimelineEventView[];
}) {
  const relatedRebuys = useMemo(() => attachNearbyRebuys(events), [events]);
  const attachedRebuyIds = new Set(relatedRebuys.map((item) => item.event.id));
  const visibleEvents = events.filter((event) => !attachedRebuyIds.has(event.id));
  if (events.length === 0) return null;

  return (
    <details className="game-timeline-panel">
      <summary className="game-timeline-summary">
        <span className="game-timeline-heading">
          <span className="form-brand-label">GAME TIMELINE</span>
          <strong>今日の卓の記録</strong>
        </span>
        <span className="game-timeline-summary-meta">
          <span className="game-timeline-count">{events.length}件</span>
          <span aria-hidden="true" className="game-timeline-toggle" />
        </span>
      </summary>

      <ol className="game-timeline-list">
        {visibleEvents.map((event) => (
          <TimelineItem
            event={event}
            key={event.id}
            relatedRebuy={
              event.type === "all_in"
                ? relatedRebuys.find((item) => item.allInId === event.id)?.event ?? null
                : null
            }
          />
        ))}
      </ol>
    </details>
  );
}

function TimelineItem({
  event,
  relatedRebuy,
}: {
  event: GameTimelineEventView;
  relatedRebuy: RebuyTimelineEvent | null;
}) {
  const isHighlight =
    event.type === "seven_deuce" ||
    event.type === "bomb_pot" ||
    event.type === "all_in";
  return (
    <li className={`game-timeline-item${isHighlight ? " is-highlight" : ""}`}>
      <time dateTime={event.recordedAt}>{formatTimelineTime(event.recordedAt)}</time>
      <span
        aria-hidden="true"
        className={`game-timeline-marker is-${event.type}`}
      >
        {event.type === "seven_deuce"
          ? "72"
          : event.type === "bomb_pot"
            ? "B"
            : event.type === "all_in"
              ? "🔥"
              : null}
      </span>
      {event.type === "rebuy" || event.type === "repayment" ? (
        <div className="game-timeline-event">
          <PlayerAvatar
            avatarUrl={event.avatarUrl}
            className="game-timeline-avatar"
            displayName={event.displayName}
          />
          <div>
            <strong>{event.displayName}</strong>
            <p>{event.type === "rebuy" ? "リバイ" : "100BB返済"}</p>
          </div>
        </div>
      ) : event.type === "seven_deuce" ? (
        <div className="game-timeline-event">
          <PlayerAvatar
            avatarUrl={event.subject?.avatarUrl ?? null}
            className="game-timeline-avatar"
            displayName={event.subject?.displayName ?? "72o"}
          />
          <div>
            <strong>72o成立</strong>
            <p>{event.subject?.displayName ?? "達成者不明"}</p>
          </div>
        </div>
      ) : event.type === "bomb_pot" ? (
        <div className="game-timeline-highlight">
          <strong>BOMB POT</strong>
          <p>全員参加のスペシャルハンド</p>
        </div>
      ) : (
        <div className="game-timeline-highlight">
          <strong>ALL IN</strong>
          <p>{event.players.map((player) => player.displayName).join(" vs ")}</p>
          <p className="game-timeline-win">
            🏆 {event.players.filter((player) => player.isWinner).map((player) => player.displayName).join("・")} WIN
          </p>
          {relatedRebuy ? (
            <span className="game-timeline-related-rebuy">
              ↳ {relatedRebuy.displayName} リバイ
            </span>
          ) : null}
        </div>
      )}
    </li>
  );
}

function attachNearbyRebuys(events: GameTimelineEventView[]): AttachedRebuy[] {
  const used = new Set<string>();
  const rebuys = events.filter(
    (event): event is RebuyTimelineEvent => event.type === "rebuy",
  );
  const allIns = events.filter(
    (event): event is AllInTimelineEvent => event.type === "all_in",
  );
  const attached: AttachedRebuy[] = [];

  for (const allIn of allIns) {
    const allInTime = new Date(allIn.recordedAt).getTime();
    const losingIds = new Set(
      allIn.players
        .filter((player) => !player.isWinner)
        .map((player) => player.groupPlayerId),
    );
    const candidate = rebuys
      .filter(
        (rebuy) =>
          !used.has(rebuy.id) &&
          losingIds.has(rebuy.groupPlayerId) &&
          Math.abs(new Date(rebuy.recordedAt).getTime() - allInTime) <= 3 * 60 * 1000,
      )
      .sort(
        (left, right) =>
          Math.abs(new Date(left.recordedAt).getTime() - allInTime) -
          Math.abs(new Date(right.recordedAt).getTime() - allInTime),
      )[0];
    if (!candidate) continue;
    used.add(candidate.id);
    attached.push({ allInId: allIn.id, event: candidate });
  }
  return attached;
}

export function buildGameTimelinePath(pathname: string): string {
  return `${pathname.replace(/\/+$/u, "")}/timeline`;
}

function formatTimelineTime(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));
}
