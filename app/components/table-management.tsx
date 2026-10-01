import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { IconArrowDown, IconArrowUp } from "@tabler/icons-react";
import { useRevalidator } from "react-router";
import { BodyPortal } from "~/components/body-portal";
import { orderSubTable, subStayMinutes } from "@domain/table-management/table-management";
import type { TableManagementPanel, TableSeat } from "@shared-types/table-management";
import "~/styles/table-events.css";
import "~/styles/table-management.css";

const OPEN_EVENT = "rivercheck:open-table-management";
export function openTableManagement(groupPlayerId: string | null = null) {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: groupPlayerId }));
}

export function TableManagement({ resourcePath, started, manager, hideTrigger = false,
  embedded = false, visible = false, onRequestOpen, onPendingChange, onPlayerClick, playerDetails, children,
}: {
  resourcePath: string; started: boolean; manager: boolean; hideTrigger?: boolean;
  embedded?: boolean; visible?: boolean; onRequestOpen?: () => void;
  onPendingChange?: (pending: boolean) => void;
  onPlayerClick?: (seat: TableSeat) => void;
  playerDetails?: (seat: TableSeat) => ReactNode;
  children?: ReactNode;
}) {
  const revalidator = useRevalidator();
  const [open, setOpen] = useState(false);
  const isOpen = embedded ? visible : open;
  const [allocating, setAllocating] = useState(false);
  const [panel, setPanel] = useState<TableManagementPanel | null>(null);
  const [subIds, setSubIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const pendingRef = useRef(false);
  const clockRef = useRef({ server: 0, local: 0 });
  const retryCommand = useRef<{ key: string; id: string } | null>(null);

  const refresh = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError(null);
    const timeout = window.setTimeout(() => {
      controller.abort();
      setLoading(false);
      setError("情報を読み込めませんでした。更新してもう一度お試しください。");
    }, 15_000);
    try {
      const response = await fetch(resourcePath, { credentials: "same-origin", signal: controller.signal, headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("load");
      const next = await response.json() as TableManagementPanel;
      if (controller.signal.aborted) return;
      setPanel(next);
      setSubIds(next.startedAt ? [] : next.participants.slice(6).map((seat) => seat.groupPlayerId));
      clockRef.current = { server: Date.parse(next.serverNow), local: performance.now() };
      setNow(clockRef.current.server);
    } catch {
      if (!controller.signal.aborted) setError("情報を読み込めませんでした。更新してもう一度お試しください。");
    } finally {
      window.clearTimeout(timeout);
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [resourcePath]);

  useEffect(() => {
    setPanel(null);
    setFeedback(null);
    retryCommand.current = null;
  }, [resourcePath]);

  useEffect(() => {
    if (!isOpen) return;
    setAllocating(!embedded);
    void refresh();
    const timer = window.setInterval(() => setNow(clockRef.current.server + performance.now() - clockRef.current.local), 10_000);
    return () => {
      requestRef.current?.abort();
      window.clearInterval(timer);
    };
  }, [isOpen, refresh, embedded]);

  useEffect(() => {
    if (isOpen && dialog.current && !dialog.current.open) dialog.current.showModal();
    if (!isOpen && dialog.current?.open) dialog.current.close();
  }, [isOpen]);

  function show(groupPlayerId: string | null = null) {
    if (pendingRef.current) return;
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setHighlightId(groupPlayerId);
    setFeedback(null);
    setError(null);
    setAllocating(!embedded);
    if (embedded) onRequestOpen?.();
    else setOpen(true);
  }
  useEffect(() => {
    const listener = (event: Event) => show((event as CustomEvent<string | null>).detail);
    window.addEventListener(OPEN_EVENT, listener);
    return () => window.removeEventListener(OPEN_EVENT, listener);
  });

  async function post(form: FormData, message: string) {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setError(null);
    setFeedback(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(resourcePath, { method: "POST", body: form, signal: controller.signal, credentials: "same-origin", headers: { Accept: "application/json" } });
      const result = await response.json() as { ok: boolean; error?: string };
      if (!response.ok || !result.ok) {
        setError(result.error ?? "変更できませんでした。更新してください。");
        return;
      }
      retryCommand.current = null;
      setHighlightId(null);
      await refresh();
      setFeedback(message);
      // Keep the PLAYERS button count and profile metadata in sync after edits.
      void revalidator.revalidate();
    } catch {
      setError("通信に失敗しました。更新で状態を確認するか、同じ操作を再試行してください。");
    } finally {
      window.clearTimeout(timeout);
      pendingRef.current = false;
      setPending(false);
    }
  }
  function move(seat: TableSeat) {
    const target = seat.table === "MAIN" ? "SUB" : "MAIN";
    const key = `${seat.groupPlayerId}:${seat.table}:${seat.subEnteredAt}`;
    if (retryCommand.current?.key !== key) retryCommand.current = { key, id: crypto.randomUUID() };
    const form = new FormData();
    form.set("intent", "move");
    form.set("commandId", retryCommand.current.id);
    form.set("groupPlayerId", seat.groupPlayerId);
    form.set("fromTable", seat.table);
    form.set("toTable", target);
    form.set("expectedSubEnteredAt", seat.subEnteredAt ?? "");
    void post(form, `${seat.displayName}を${target === "MAIN" ? "メイン" : "サブ"}へ移動しました`);
  }
  function start() {
    if (!panel) return;
    const form = new FormData();
    form.set("intent", "start");
    panel.participants.forEach((seat) => form.append(subIds.includes(seat.groupPlayerId) ? "subIds" : "mainIds", seat.groupPlayerId));
    void post(form, "卓管理を開始しました");
  }
  function close() { if (!pendingRef.current) setOpen(false); }
  const active = panel?.startedAt != null;
  const canManage = panel?.canManage === true;

  useEffect(() => { onPendingChange?.(pending); }, [pending, onPendingChange]);

  if (!embedded && !manager && !started) return null;
  const content = <div className="table-management-content" aria-busy={pending}>
          {error ? <p className="table-event-error" role="alert">{error}</p> : null}
          <div className="table-management-toolbar">
            <p className="table-management-feedback" role="status" title={feedback ?? undefined}>{feedback}</p>
            <button className="table-management-refresh" disabled={loading || pending} type="button" onClick={() => { void refresh(); void revalidator.revalidate(); }}>{loading ? "更新中…" : "情報を更新"}</button>
          </div>
          {!panel && !started && embedded ? children : null}
          {loading && !panel ? <p className="table-event-hint" role="status">読み込み中…</p> : null}
          {panel ? active ? <TableManagementBoard panel={panel} now={now} disabled={pending || loading} highlightId={highlightId} onMove={move} onPlayerClick={onPlayerClick} playerDetails={playerDetails} /> : canManage && allocating ? <>
            {embedded ? <button className="table-management-refresh" disabled={pending} type="button" onClick={() => setAllocating(false)}>一覧に戻る</button> : null}
            <p className="table-event-hint">名前をタップして振り分けます。サブ滞在時間は開始した時点から計測します。</p>
            <h3>メイン {panel.participants.length - subIds.length}人 / サブ {subIds.length}人</h3>
            <div className="table-allocation-list">
              {panel.participants.map((seat) => <button key={seat.groupPlayerId} type="button" disabled={pending || loading}
                className={subIds.includes(seat.groupPlayerId) ? "is-sub-table" : "is-main-table"}
                aria-label={`${seat.displayName}を${subIds.includes(seat.groupPlayerId) ? "メイン" : "サブ"}へ振り分け`}
                onClick={() => setSubIds((ids) => ids.includes(seat.groupPlayerId) ? ids.filter((id) => id !== seat.groupPlayerId) : [...ids, seat.groupPlayerId])}>
                <strong>{seat.displayName}</strong><span className="table-position-badge">{subIds.includes(seat.groupPlayerId) ? "サブ" : "メイン"} ⇄</span>
              </button>)}
            </div>
            <button className="button button-primary" disabled={pending || loading || subIds.length === 0 || subIds.length === panel.participants.length} type="button" onClick={start}>{pending ? "開始中…" : "この振り分けで開始"}</button>
            {panel.participants.length < 2 ? <p className="table-event-hint">2人以上の参加者が必要です。</p> : null}
          </> : <>{children}{canManage ? <button className="button button-secondary table-management-trigger" type="button" onClick={() => setAllocating(true)}>卓管理を開始</button> : null}</> : null}
  </div>;
  if (embedded) return content;
  return <>
    {!hideTrigger ? <button className="button button-secondary table-management-trigger" type="button" onClick={() => show()}>
      {started ? "卓管理" : "卓管理を開始"}
    </button> : null}
    <BodyPortal>
      <dialog ref={dialog} className="table-event-dialog table-management-dialog" aria-labelledby="table-management-title"
        onCancel={(event) => { event.preventDefault(); close(); }}
        onClick={(event) => { if (event.target === event.currentTarget) close(); }}
        onClose={() => { setOpen(false); returnFocus.current?.focus(); }}>
        <div className="table-event-sheet table-management-sheet">
          <header className="table-event-header">
            <div><p className="eyebrow">TABLES</p><h2 id="table-management-title">卓管理</h2></div>
            <button className="participant-roster-close" aria-label="卓管理を閉じる" disabled={pending} type="button" onClick={close}>×</button>
          </header>
          {content}
        </div>
      </dialog>
    </BodyPortal>
  </>;
}

export function TableManagementBoard({ panel, now, disabled, highlightId, onMove, onPlayerClick, playerDetails }: {
  panel: TableManagementPanel; now: number; disabled: boolean; highlightId: string | null;
  onMove: (seat: TableSeat) => void;
  onPlayerClick?: (seat: TableSeat) => void;
  playerDetails?: (seat: TableSeat) => ReactNode;
}) {
  const sub = orderSubTable(panel.participants);
  const candidate = sub[0];
  return <div className="table-management-board">
    {candidate ? <section className="table-next-candidate" aria-label="次のメイン候補">
      <p>次のメイン候補</p><strong>{candidate.displayName}</strong>
      <span>サブ滞在 {subStayMinutes(candidate.subEnteredAt!, now)}分</span>
      {panel.canManage ? <button className="button button-primary" disabled={disabled} type="button" onClick={() => onMove(candidate)}>メインへ移動</button> : null}
    </section> : null}
    {([{ name: "メイン", tone: "is-main-table", seats: panel.participants.filter((seat) => seat.table === "MAIN") }, { name: "サブ", tone: "is-sub-table", seats: sub }]).map(({ name, tone, seats }) =>
      <section key={name} className={`table-seat-section ${tone}`}>
        <h3>{name}<small>{seats.length}人</small></h3>
        <ul>{seats.map((seat) => <li key={seat.groupPlayerId} className={highlightId === seat.groupPlayerId ? "is-highlighted" : undefined}>
          <div className="table-seat-row">
            {onPlayerClick ? <button className="table-seat-profile" type="button" aria-label={`${seat.displayName}のプロフィールを見る`} onClick={() => onPlayerClick(seat)}>
              <strong>{seat.displayName}</strong>{playerDetails?.(seat)}
            </button> : <strong>{seat.displayName}</strong>}
            {seat.table === "SUB" ? <span className="table-seat-stay">{subStayMinutes(seat.subEnteredAt!, now)}分</span> : null}
            {panel.canManage ? <button className={`table-seat-move ${seat.table === "MAIN" ? "to-sub" : "to-main"}`} disabled={disabled} type="button" aria-label={`${seat.displayName}を${seat.table === "MAIN" ? "サブ" : "メイン"}へ移動`} title={`${seat.table === "MAIN" ? "サブ" : "メイン"}へ移動`} onClick={() => onMove(seat)}>
              {seat.table === "MAIN" ? <IconArrowDown aria-hidden="true" stroke={1.7} /> : <IconArrowUp aria-hidden="true" stroke={1.7} />}
            </button> : null}
          </div>
        </li>)}</ul>
      </section>)}
    {panel.canManage ? <p className="table-event-hint">↓でサブ、↑でメインへ移動します。</p> : null}
    {panel.moves.length > 0 ? <details className="table-move-history"><summary>移動の履歴（{panel.moves.length}件）</summary>
      <ol>{panel.moves.map((move) => <li key={move.id}><time dateTime={move.recordedAt}>{new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(move.recordedAt))}</time><span>{move.displayName} {move.fromTable === "MAIN" ? "メイン" : "サブ"} → {move.toTable === "MAIN" ? "メイン" : "サブ"}</span></li>)}</ol>
    </details> : null}
  </div>;
}
