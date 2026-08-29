import { useEffect, useState } from "react";
import { PlayerAvatar } from "./player-avatar";

export interface GameTimelineEventView {
  id: string;
  type: "rebuy" | "repayment";
  recordedAt: string;
  displayName: string;
  avatarUrl: string | null;
}

interface GameTimelineResponse {
  events: GameTimelineEventView[];
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
  if (events.length === 0) return null;

  return (
    <details className="game-timeline-panel">
      <summary className="game-timeline-summary">
        <span className="game-timeline-heading">
          <span className="form-brand-label">GAME TIMELINE</span>
          <strong>リバイと返済の記録</strong>
        </span>
        <span className="game-timeline-summary-meta">
          <span className="game-timeline-count">{events.length}件</span>
          <span aria-hidden="true" className="game-timeline-toggle" />
        </span>
      </summary>

      <ol className="game-timeline-list">
        {events.map((event) => (
          <li className="game-timeline-item" key={event.id}>
            <time dateTime={event.recordedAt}>
              {formatTimelineTime(event.recordedAt)}
            </time>
            <span
              aria-hidden="true"
              className={`game-timeline-marker is-${event.type}`}
            />
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
          </li>
        ))}
      </ol>
    </details>
  );
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
