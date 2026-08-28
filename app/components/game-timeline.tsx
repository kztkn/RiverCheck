import { PlayerAvatar } from "./player-avatar";

export interface GameTimelineEventView {
  id: string;
  type: "rebuy" | "repayment";
  recordedAt: string;
  displayName: string;
  avatarUrl: string | null;
}

export function GameTimeline({ events }: { events: GameTimelineEventView[] }) {
  if (events.length === 0) return null;

  return (
    <section className="game-timeline-panel" aria-labelledby="game-timeline-heading">
      <header className="game-timeline-heading">
        <p className="form-brand-label">GAME TIMELINE</p>
        <h2 id="game-timeline-heading">リバイと返済の記録</h2>
      </header>

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
    </section>
  );
}

function formatTimelineTime(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));
}
