import { useCallback, useEffect, useRef, useState } from "react";
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

export function TableManagement({ resourcePath, started, manager, hideTrigger = false }: {
  resourcePath: string; started: boolean; manager: boolean; hideTrigger?: boolean;
}) {
  const revalidator = useRevalidator();
  const [open, setOpen] = useState(false);
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
      setError("卓情報を読み込めませんでした。更新してもう一度お試しください。");
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
      if (!controller.signal.aborted) setError("卓情報を読み込めませんでした。更新してもう一度お試しください。");
    } finally {
      window.clearTimeout(timeout);
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [resourcePath]);

  useEffect(() => {
    if (!open) return;
    void refresh();
    const timer = window.setInterval(() => setNow(clockRef.current.server + performance.now() - clockRef.current.local), 10_000);
    return () => {
      requestRef.current?.abort();
      window.clearInterval(timer);
    };
  }, [open, refresh]);

  useEffect(() => {
    if (open && dialog.current && !dialog.current.open) dialog.current.showModal();
    if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);

  function show(groupPlayerId: string | null = null) {
    if (pendingRef.current) return;
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setHighlightId(groupPlayerId);
    setPanel(null);
    setFeedback(null);
    setError(null);
    setOpen(true);
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
        setError(result.error ?? "卓を変更できませんでした。更新してください。");
        return;
      }
      retryCommand.current = null;
      setHighlightId(null);
      await refresh();
      setFeedback(message);
      // The panel is the current source. Parent loaders only need the start flag.
      if (form.get("intent") === "start") void revalidator.revalidate();
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
    void post(form, `${seat.displayName}を${target === "MAIN" ? "メイン" : "サブ"}卓へ移動しました`);
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
  const subSeats = panel ? orderSubTable(panel.participants) : [];

  if (!manager && !started) return null;
  return <>
    {!hideTrigger ? <button className="button button-secondary table-management-trigger" type="button" onClick={() => show()}>
      {started ? "卓管理" : "卓管理を開始"}
    </button> : null}
    <BodyPortal>
      <dialog ref={dialog} className="table-event-dialog table-management-dialog" aria-labelledby="table-management-title"
        onCancel={(event) => { event.preventDefault(); close(); }}
        onClick={(event) => { if (event.target === event.currentTarget) close(); }}
        onClose={() => { setOpen(false); returnFocus.current?.focus(); }}>
        <div className="table-event-sheet table-management-sheet" aria-busy={pending}>
          <header className="table-event-header">
            <div><p className="eyebrow">TABLES</p><h2 id="table-management-title">卓管理</h2></div>
            <button className="participant-roster-close" aria-label="卓管理を閉じる" disabled={pending} type="button" onClick={close}>×</button>
          </header>
          {error ? <p className="table-event-error" role="alert">{error}</p> : null}
          {feedback ? <p className="table-event-feedback" role="status">{feedback}</p> : null}
          <button className="table-management-refresh" disabled={loading || pending} type="button" onClick={() => void refresh()}>卓情報を更新</button>
          {loading ? <p className="table-event-hint" role="status">読み込み中…</p> : null}
          {!loading && panel ? active ? <TableManagementBoard panel={panel} now={now} disabled={pending} highlightId={highlightId} onMove={move} /> : canManage ? <>
            <p className="table-event-hint">名前をタップして振り分けます。サブ滞在時間は開始した時点から計測します。</p>
            <h3>メイン {panel.participants.length - subIds.length}人 / サブ {subIds.length}人</h3>
            <div className="table-allocation-list">
              {panel.participants.map((seat) => <button key={seat.groupPlayerId} type="button" disabled={pending}
                className={subIds.includes(seat.groupPlayerId) ? "is-sub-table" : "is-main-table"}
                aria-label={`${seat.displayName}を${subIds.includes(seat.groupPlayerId) ? "メイン" : "サブ"}卓へ振り分け`}
                onClick={() => setSubIds((ids) => ids.includes(seat.groupPlayerId) ? ids.filter((id) => id !== seat.groupPlayerId) : [...ids, seat.groupPlayerId])}>
                <strong>{seat.displayName}</strong><span className="table-position-badge">{subIds.includes(seat.groupPlayerId) ? "サブ" : "メイン"} ⇄</span>
              </button>)}
            </div>
            <button className="button button-primary" disabled={pending || subIds.length === 0 || subIds.length === panel.participants.length} type="button" onClick={start}>{pending ? "開始中…" : "この振り分けで開始"}</button>
            {panel.participants.length < 2 ? <p className="table-event-hint">2人以上の参加者が必要です。</p> : null}
          </> : <p className="table-event-hint">卓管理はまだ開始されていません。</p> : null}
          {active && !loading && subSeats.length === 0 ? <p className="table-event-hint">サブ卓に参加者はいません。</p> : null}
        </div>
      </dialog>
    </BodyPortal>
  </>;
}

export function TableManagementBoard({ panel, now, disabled, highlightId, onMove }: {
  panel: TableManagementPanel; now: number; disabled: boolean; highlightId: string | null;
  onMove: (seat: TableSeat) => void;
}) {
  const sub = orderSubTable(panel.participants);
  const candidate = sub[0];
  return <div className="table-management-board">
    {candidate ? <section className="table-next-candidate" aria-label="次のメイン候補">
      <p>次のメイン候補</p><strong>{candidate.displayName}</strong>
      <span>サブ滞在 {subStayMinutes(candidate.subEnteredAt!, now)}分</span>
      {panel.canManage ? <button className="button button-primary" disabled={disabled} type="button" onClick={() => onMove(candidate)}>メインへ移動</button> : null}
    </section> : null}
    {([{ name: "メイン卓", tone: "is-main-table", seats: panel.participants.filter((seat) => seat.table === "MAIN") }, { name: "サブ卓", tone: "is-sub-table", seats: sub }]).map(({ name, tone, seats }) =>
      <section key={name} className={`table-seat-section ${tone}`}>
        <h3>{name}<small>{seats.length}人</small></h3>
        <ul>{seats.map((seat) => <li key={seat.groupPlayerId} className={highlightId === seat.groupPlayerId ? "is-highlighted" : undefined}>
          {panel.canManage ? <button disabled={disabled} type="button" aria-label={`${seat.displayName}を${seat.table === "MAIN" ? "サブ" : "メイン"}へ移動`} onClick={() => onMove(seat)}>
            <strong>{seat.displayName}</strong><span>{seat.table === "SUB" ? `${subStayMinutes(seat.subEnteredAt!, now)}分 · ` : ""}{seat.table === "MAIN" ? "サブ" : "メイン"}へ ›</span>
          </button> : <div><strong>{seat.displayName}</strong>{seat.table === "SUB" ? <span>{subStayMinutes(seat.subEnteredAt!, now)}分</span> : null}</div>}
        </li>)}</ul>
      </section>)}
    {panel.canManage ? <p className="table-event-hint">名前をタップすると表示先の卓へ移動します。</p> : null}
    {panel.moves.length > 0 ? <details className="table-move-history"><summary>卓移動の履歴（{panel.moves.length}件）</summary>
      <ol>{panel.moves.map((move) => <li key={move.id}><time dateTime={move.recordedAt}>{new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(move.recordedAt))}</time><span>{move.displayName} {move.fromTable} → {move.toTable}</span></li>)}</ol>
    </details> : null}
  </div>;
}
