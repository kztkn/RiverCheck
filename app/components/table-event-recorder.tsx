import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router";

interface TableEventParticipant {
  groupPlayerId: string;
  displayName: string;
}

interface RecentTableEvent {
  id: string;
  type: "seven_deuce" | "bomb_pot" | "all_in";
  recordedAt: string;
  subject: { groupPlayerId: string; displayName: string } | null;
  players: Array<{
    groupPlayerId: string;
    displayName: string;
    isWinner: boolean;
  }>;
  canCancel: boolean;
}

interface TableEventPanelResponse {
  canRecord: boolean;
  currentGroupPlayerId: string | null;
  rules: { sevenDeuce: boolean; bombPot: boolean };
  participants: TableEventParticipant[];
  recentEvents: RecentTableEvent[];
}

type RecorderMode = "menu" | "seven-deuce" | "all-in";

export function TableEventRecorder() {
  const location = useLocation();
  const resourcePath = useMemo(
    () => buildTableEventsPath(location.pathname),
    [location.pathname],
  );
  const [panel, setPanel] = useState<TableEventPanelResponse | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<RecorderMode>("menu");
  const [subjectId, setSubjectId] = useState("");
  const [allInIds, setAllInIds] = useState<string[]>([]);
  const [winnerIds, setWinnerIds] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  async function refreshPanel(path = resourcePath) {
    if (!path) {
      setPanel(null);
      return;
    }
    try {
      const response = await fetch(path, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        setPanel(null);
        return;
      }
      const next = (await response.json()) as TableEventPanelResponse;
      setPanel(next.canRecord ? next : null);
      if (next.currentGroupPlayerId) {
        setSubjectId((current) => current || next.currentGroupPlayerId || "");
      }
    } catch {
      setPanel(null);
    }
  }

  useEffect(() => {
    let active = true;
    if (!resourcePath) {
      setPanel(null);
      return;
    }
    void fetch(resourcePath, {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as TableEventPanelResponse;
      })
      .then((next) => {
        if (!active) return;
        setPanel(next?.canRecord ? next : null);
        if (next?.currentGroupPlayerId) setSubjectId(next.currentGroupPlayerId);
      })
      .catch(() => {
        if (active) setPanel(null);
      });
    return () => {
      active = false;
    };
  }, [resourcePath]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  if (!resourcePath || !panel) return null;

  function openRecorder() {
    setMode("menu");
    setFeedback(null);
    setError(null);
    setIsOpen(true);
    void refreshPanel();
  }

  function closeRecorder() {
    setIsOpen(false);
    setMode("menu");
    setAllInIds([]);
    setWinnerIds([]);
    setError(null);
  }

  function toggleAllInPlayer(groupPlayerId: string) {
    setAllInIds((current) => {
      if (current.includes(groupPlayerId)) {
        setWinnerIds((winners) => winners.filter((id) => id !== groupPlayerId));
        return current.filter((id) => id !== groupPlayerId);
      }
      return [...current, groupPlayerId];
    });
  }

  function toggleWinner(groupPlayerId: string) {
    if (!allInIds.includes(groupPlayerId)) return;
    setWinnerIds((current) =>
      current.includes(groupPlayerId)
        ? current.filter((id) => id !== groupPlayerId)
        : [...current, groupPlayerId],
    );
  }

  async function postEvent(formData: FormData, successMessage: string) {
    if (!resourcePath || pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(resourcePath, {
        method: "POST",
        body: formData,
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const result = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !result.ok) {
        setError(result.error ?? "テーブルイベントを記録できませんでした。");
        return;
      }
      setFeedback(successMessage);
      setMode("menu");
      setAllInIds([]);
      setWinnerIds([]);
      await refreshPanel();
    } catch {
      setError("通信に失敗しました。もう一度お試しください。");
    } finally {
      setPending(false);
    }
  }

  function recordSevenDeuce() {
    if (!subjectId) return;
    const formData = baseCommand("seven-deuce");
    formData.set("subjectGroupPlayerId", subjectId);
    void postEvent(formData, "72o成立を記録しました");
  }

  function recordBombPot() {
    void postEvent(baseCommand("bomb-pot"), "BOMB POTを記録しました");
  }

  function recordAllIn() {
    const formData = baseCommand("all-in");
    allInIds.forEach((id) => formData.append("participantIds", id));
    winnerIds.forEach((id) => formData.append("winnerIds", id));
    void postEvent(formData, "ALL INを記録しました");
  }

  async function cancelEvent(eventId: string) {
    if (!resourcePath || pending) return;
    const formData = new FormData();
    formData.set("intent", "cancel");
    formData.set("eventId", eventId);
    await postEvent(formData, "テーブルイベントを取り消しました");
  }

  return (
    <>
      <button
        className="table-event-trigger"
        onClick={openRecorder}
        ref={triggerRef}
        type="button"
      >
        <span aria-hidden="true">＋</span>
        テーブルイベント
      </button>
      <dialog
        aria-labelledby="table-event-title"
        className="app-dialog table-event-dialog"
        onCancel={closeRecorder}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeRecorder();
        }}
        onClose={() => {
          setIsOpen(false);
          triggerRef.current?.focus();
        }}
        ref={dialogRef}
      >
        <div className="table-event-sheet">
          <header className="table-event-header">
            <div>
              <p className="eyebrow">TABLE EVENT</p>
              <h2 id="table-event-title">テーブルイベントを記録</h2>
            </div>
            <button
              aria-label="テーブルイベントを閉じる"
              className="participant-roster-close"
              onClick={closeRecorder}
              type="button"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </header>

          {feedback ? <p className="table-event-feedback">✓ {feedback}</p> : null}
          {error ? <p className="table-event-error" role="alert">{error}</p> : null}

          {mode === "menu" ? (
            <div className="table-event-menu">
              {panel.rules.sevenDeuce ? (
                <button onClick={() => setMode("seven-deuce")} type="button">
                  <strong>72o成立</strong>
                  <small>達成したプレイヤーを記録</small>
                </button>
              ) : null}
              {panel.rules.bombPot ? (
                <button disabled={pending} onClick={recordBombPot} type="button">
                  <strong>BOMB POT</strong>
                  <small>この瞬間をワンタップで記録</small>
                </button>
              ) : null}
              <button onClick={() => setMode("all-in")} type="button">
                <strong>ALL IN</strong>
                <small>参加者と勝者だけを残す</small>
              </button>
            </div>
          ) : mode === "seven-deuce" ? (
            <div className="table-event-editor">
              <button className="table-event-back" onClick={() => setMode("menu")} type="button">‹ 戻る</button>
              <h3>72oを決めたのは？</h3>
              <div className="table-event-player-grid">
                {panel.participants.map((participant) => (
                  <button
                    className={subjectId === participant.groupPlayerId ? "is-selected" : undefined}
                    key={participant.groupPlayerId}
                    onClick={() => setSubjectId(participant.groupPlayerId)}
                    type="button"
                  >
                    {participant.displayName}
                  </button>
                ))}
              </div>
              <button className="button button-primary" disabled={!subjectId || pending} onClick={recordSevenDeuce} type="button">
                {pending ? "記録中…" : "72o成立を記録"}
              </button>
            </div>
          ) : (
            <div className="table-event-editor">
              <button className="table-event-back" onClick={() => setMode("menu")} type="button">‹ 戻る</button>
              <h3>ALL INしたプレイヤー</h3>
              <p className="table-event-hint">2人以上を選択</p>
              <div className="table-event-player-grid">
                {panel.participants.map((participant) => (
                  <button
                    className={allInIds.includes(participant.groupPlayerId) ? "is-selected" : undefined}
                    key={participant.groupPlayerId}
                    onClick={() => toggleAllInPlayer(participant.groupPlayerId)}
                    type="button"
                  >
                    {participant.displayName}
                  </button>
                ))}
              </div>
              {allInIds.length >= 2 ? (
                <>
                  <h3>勝者</h3>
                  <p className="table-event-hint">スプリットなら複数選択OK</p>
                  <div className="table-event-player-grid is-winners">
                    {panel.participants
                      .filter((participant) => allInIds.includes(participant.groupPlayerId))
                      .map((participant) => (
                        <button
                          className={winnerIds.includes(participant.groupPlayerId) ? "is-selected" : undefined}
                          key={participant.groupPlayerId}
                          onClick={() => toggleWinner(participant.groupPlayerId)}
                          type="button"
                        >
                          {participant.displayName}
                        </button>
                      ))}
                  </div>
                </>
              ) : null}
              <button
                className="button button-primary"
                disabled={allInIds.length < 2 || winnerIds.length < 1 || pending}
                onClick={recordAllIn}
                type="button"
              >
                {pending ? "記録中…" : "ALL INを記録"}
              </button>
            </div>
          )}

          {panel.recentEvents.length > 0 ? (
            <section className="table-event-recent">
              <h3>最近のテーブルイベント</h3>
              <ul>
                {panel.recentEvents.map((event) => (
                  <li key={event.id}>
                    <div>
                      <time dateTime={event.recordedAt}>{formatTime(event.recordedAt)}</time>
                      <strong>{formatRecentEvent(event)}</strong>
                    </div>
                    {event.canCancel ? (
                      <button disabled={pending} onClick={() => void cancelEvent(event.id)} type="button">取消</button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </dialog>
    </>
  );
}

export function buildTableEventsPath(pathname: string): string | null {
  const match = pathname.match(/^\/g\/[^/]+\/games\/[^/]+\/?$/u);
  if (!match) return null;
  return `${pathname.replace(/\/+$/u, "")}/table-events`;
}

function baseCommand(intent: string): FormData {
  const formData = new FormData();
  formData.set("intent", intent);
  formData.set("commandId", crypto.randomUUID());
  return formData;
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));
}

function formatRecentEvent(event: RecentTableEvent): string {
  if (event.type === "seven_deuce") {
    return `72o成立 · ${event.subject?.displayName ?? "-"}`;
  }
  if (event.type === "bomb_pot") return "BOMB POT";
  const players = event.players.map((player) => player.displayName).join(" vs ");
  const winners = event.players
    .filter((player) => player.isWinner)
    .map((player) => player.displayName)
    .join("・");
  return `ALL IN · ${players}${winners ? ` · ${winners} WIN` : ""}`;
}
