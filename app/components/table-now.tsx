import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import {
  IconArrowUp,
  IconBomb,
  IconCards,
  IconUsers,
} from "@tabler/icons-react";

export interface LiveTableEvent {
  id: string;
  type: "seven_deuce" | "bomb_pot" | "all_in";
  recordedAt: string;
  subject: { displayName: string } | null;
  players: Array<{ displayName: string; isWinner: boolean }>;
}

export interface TableNowData {
  allInCount: number;
  bombPotCount: number;
  playerCount: number | null;
  sevenDeuceCount: number;
  events?: LiveTableEvent[];
}

type DetailType = "all_in" | "bomb_pot" | "seven_deuce";

export function TableNow({
  data,
  onPlayersClick,
}: {
  data: TableNowData;
  onPlayersClick?: () => void;
}) {
  const [detailType, setDetailType] = useState<DetailType | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const events = [
    data.allInCount > 0
      ? {
          key: "all_in" as const,
          label: "ALL IN",
          value: data.allInCount,
          Icon: IconArrowUp,
        }
      : null,
    data.bombPotCount > 0
      ? {
          key: "bomb_pot" as const,
          label: "BOMB POT",
          value: data.bombPotCount,
          Icon: IconBomb,
        }
      : null,
    data.sevenDeuceCount > 0
      ? {
          key: "seven_deuce" as const,
          label: "72o",
          value: data.sevenDeuceCount,
          Icon: IconCards,
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (detailType && !dialog.open) dialog.showModal();
    if (!detailType && dialog.open) dialog.close();
  }, [detailType]);

  const selectedEvents = detailType
    ? (data.events ?? []).filter((event) => event.type === detailType)
    : [];

  return (
    <section aria-label="LIVE TABLE" className="table-now">
      <div className="table-now-heading">
        <span>LIVE TABLE</span>
      </div>
      <div className="table-now-scroller">
        <button
          className="table-now-item table-now-players"
          disabled={!onPlayersClick}
          onClick={onPlayersClick}
          type="button"
        >
          <IconUsers aria-hidden="true" stroke={1.7} />
          <span>
            <strong>{data.playerCount ?? "—"}</strong>
            <small>PLAYERS</small>
          </span>
        </button>
        {events.map(({ key, label, value, Icon }) => (
          <button
            className="table-now-item"
            key={key}
            onClick={() => setDetailType(key)}
            type="button"
          >
            <Icon aria-hidden="true" stroke={1.7} />
            <span>
              <small>{label}</small>
              <strong>{value}</strong>
            </span>
          </button>
        ))}
      </div>

      <dialog
        aria-labelledby="live-table-detail-title"
        className="app-dialog participant-roster-dialog live-table-detail-dialog"
        onCancel={() => setDetailType(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setDetailType(null);
        }}
        onClose={() => setDetailType(null)}
        ref={dialogRef}
      >
        <div className="participant-roster-sheet live-table-detail-sheet">
          <header className="participant-roster-header">
            <div>
              <p className="eyebrow">LIVE TABLE</p>
              <h2 id="live-table-detail-title">
                {detailType ? detailLabel(detailType) : ""}
              </h2>
            </div>
            <button
              aria-label="LIVE TABLE詳細を閉じる"
              className="participant-roster-close"
              onClick={() => setDetailType(null)}
              type="button"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </header>
          <div className="participant-roster-scroll live-table-detail-list">
            {selectedEvents.length === 0 ? (
              <p className="participant-roster-empty">記録はありません</p>
            ) : (
              selectedEvents.map((event) => (
                <article className="live-table-detail-row" key={event.id}>
                  <time dateTime={event.recordedAt}>
                    {formatTableTime(event.recordedAt)}
                  </time>
                  <div>{renderEventCopy(event)}</div>
                </article>
              ))
            )}
          </div>
        </div>
      </dialog>
    </section>
  );
}

export function LiveTableMini({
  data,
  to,
}: {
  data: TableNowData;
  to: string;
}) {
  const items = [
    `${data.playerCount ?? "—"} PLAYERS`,
    data.allInCount > 0 ? `ALL IN ${data.allInCount}` : null,
    data.bombPotCount > 0 ? `BOMB POT ${data.bombPotCount}` : null,
    data.sevenDeuceCount > 0 ? `72o ${data.sevenDeuceCount}` : null,
  ].filter((item): item is string => Boolean(item));

  return (
    <Link aria-label="LIVE TABLEを開く" className="home-live-table-mini" to={to}>
      <strong>LIVE TABLE</strong>
      <span>{items.join(" · ")}</span>
      <b aria-hidden="true">→</b>
    </Link>
  );
}

function detailLabel(type: DetailType) {
  if (type === "all_in") return "ALL IN";
  if (type === "bomb_pot") return "BOMB POT";
  return "72o成立";
}

function renderEventCopy(event: LiveTableEvent) {
  if (event.type === "seven_deuce") {
    return <strong>{event.subject?.displayName ?? "プレイヤー"}</strong>;
  }
  if (event.type === "bomb_pot") {
    return <strong>BOMB POT</strong>;
  }

  const winners = event.players
    .filter((player) => player.isWinner)
    .map((player) => player.displayName);
  const players = event.players.map((player) => player.displayName);

  return (
    <>
      <strong>勝者 {winners.join("・") || "—"}</strong>
      <small>{players.join("・")}</small>
    </>
  );
}

function formatTableTime(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));
}
