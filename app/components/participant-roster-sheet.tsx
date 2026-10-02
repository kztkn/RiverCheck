import { useEffect, useRef, useState } from "react";
import { Link, useFetcher } from "react-router";
import { IconChevronLeft, IconPencil } from "@tabler/icons-react";
import { PlayerAvatar } from "~/components/player-avatar";
import { TableManagement } from "~/components/table-management";
import { formatSignedBbValue } from "@domain/score/bb-score";
import { PARTICIPANT_TABLE_STATUS_MAX_LENGTH } from "@domain/participant-status/participant-table-status";
import "~/styles/participant-status.css";

export type ParticipantStatusActionData = {
  intent: "update-table-status";
  ok: boolean;
  error?: string;
  statusText?: string | null;
};

export type ParticipantQuickStatsData =
  | {
      ok: true;
      groupPlayerId: string;
      displayName: string;
      avatarUrl: string | null;
      gamesPlayed: number;
      wins: number;
      topThreeRate: number;
      totalNetBb: number;
      recentThreeNetBb: number | null;
    }
  | {
      ok: false;
      error: string;
    };

const PARTICIPANT_STATUS_PRESETS = [
  "絶好調 🔥",
  "眠い 🥱",
  "今日は堅め",
  "72o待ち 🃏",
] as const;

interface ParticipantRosterItem {
  groupPlayerId: string;
  displayName: string;
  avatarUrl: string | null;
  isCurrentUser: boolean;
  statusText?: string;
}

type ParticipantStatusFetcher = ReturnType<
  typeof useFetcher<ParticipantStatusActionData>
>;
type ParticipantQuickStatsFetcher = ReturnType<
  typeof useFetcher<ParticipantQuickStatsData>
>;

export function ParticipantRosterSheet({
  available,
  externalOpenSignal = 0,
  hideTrigger = false,
  items,
  onOpen,
  profileBasePath,
  quickStatsBasePath,
  quickStatsFetcher,
  statusFetcher,
  statusAction,
  tableManagement,
}: {
  tableManagement?: {
    resourcePath: string;
    manager: boolean;
    started: boolean;
  };
  available: boolean;
  externalOpenSignal?: number;
  hideTrigger?: boolean;
  items: ParticipantRosterItem[];
  onOpen?: () => void;
  profileBasePath?: string;
  quickStatsBasePath?: string;
  quickStatsFetcher?: ParticipantQuickStatsFetcher;
  statusFetcher?: ParticipantStatusFetcher;
  statusAction?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [tablePending, setTablePending] = useState(false);
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [selectedPlayer, setSelectedPlayer] =
    useState<ParticipantRosterItem | null>(null);
  const selectedPlayerId = selectedPlayer?.groupPlayerId ?? null;
  const [quickStatsCache, setQuickStatsCache] = useState<
    Record<string, Extract<ParticipantQuickStatsData, { ok: true }>>
  >({});
  const [quickStatsErrors, setQuickStatsErrors] = useState<
    Record<string, string>
  >({});
  const currentItem = items.find((item) => item.isCurrentUser) ?? null;
  const selectedItem = selectedPlayerId
    ? (items.find((item) => item.groupPlayerId === selectedPlayerId) ??
      selectedPlayer)
    : null;
  const selectedStats = selectedPlayerId
    ? (quickStatsCache[selectedPlayerId] ?? null)
    : null;
  const selectedError = selectedPlayerId
    ? (quickStatsErrors[selectedPlayerId] ?? null)
    : null;
  const [statusDraft, setStatusDraft] = useState(currentItem?.statusText ?? "");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const rosterScrollRef = useRef<HTMLDivElement>(null);
  const rosterScrollTopRef = useRef(0);
  const pendingQuickStatsPlayerIdRef = useRef<string | null>(null);
  const countLabel = available ? String(items.length) : "—";
  const statusLength = Array.from(statusDraft).length;
  const statusFetcherData = statusFetcher?.data;
  const statusFetcherState = statusFetcher?.state ?? "idle";
  const statusPending = statusFetcherState !== "idle";
  const quickStatsPending =
    Boolean(selectedPlayerId) &&
    !selectedStats &&
    !selectedError &&
    quickStatsFetcher?.state !== "idle";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isEditingStatus) return;
    setStatusDraft(currentItem?.statusText ?? "");
  }, [currentItem?.statusText, isEditingStatus]);

  useEffect(() => {
    if (statusFetcherState !== "idle" || !statusFetcherData?.ok) return;
    setStatusDraft(statusFetcherData.statusText ?? "");
    setIsEditingStatus(false);
  }, [statusFetcherData, statusFetcherState]);

  useEffect(() => {
    const playerId = pendingQuickStatsPlayerIdRef.current;
    const data = quickStatsFetcher?.data;
    if (!playerId || quickStatsFetcher?.state !== "idle" || !data) return;

    pendingQuickStatsPlayerIdRef.current = null;
    if (data.ok) {
      setQuickStatsCache((current) => ({ ...current, [playerId]: data }));
      setQuickStatsErrors((current) => {
        const next = { ...current };
        delete next[playerId];
        return next;
      });
    } else {
      setQuickStatsErrors((current) => ({
        ...current,
        [playerId]: data.error,
      }));
    }
  }, [quickStatsFetcher?.data, quickStatsFetcher?.state]);

  function closeSheet() {
    if (tablePending || statusPending) return;
    setIsEditingStatus(false);
    setSelectedPlayer(null);
    setIsOpen(false);
  }

  function handleDialogClose() {
    setIsEditingStatus(false);
    setSelectedPlayer(null);
    setIsOpen(false);
    (returnFocusRef.current ?? triggerRef.current)?.focus();
  }

  function openSheet() {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    onOpen?.();
    setIsOpen(true);
  }

  useEffect(() => {
    if (externalOpenSignal <= 0) return;
    openSheet();
  }, [externalOpenSignal]);

  function startStatusEdit() {
    setStatusDraft(currentItem?.statusText ?? "");
    setIsEditingStatus(true);
  }

  function cancelStatusEdit() {
    setStatusDraft(currentItem?.statusText ?? "");
    setIsEditingStatus(false);
  }

  function loadQuickStats(playerId: string) {
    if (!quickStatsBasePath || !quickStatsFetcher) return;
    pendingQuickStatsPlayerIdRef.current = playerId;
    setQuickStatsErrors((current) => {
      const next = { ...current };
      delete next[playerId];
      return next;
    });
    void quickStatsFetcher.load(
      `${quickStatsBasePath}/${encodeURIComponent(playerId)}/quick-stats`,
    );
  }

  function openPlayerSnapshot(item: ParticipantRosterItem) {
    rosterScrollTopRef.current = rosterScrollRef.current?.scrollTop ?? 0;
    setSelectedPlayer(item);
    if (!quickStatsCache[item.groupPlayerId]) {
      loadQuickStats(item.groupPlayerId);
    }
  }

  function returnToRoster() {
    setIsEditingStatus(false);
    setSelectedPlayer(null);
    window.requestAnimationFrame(() => {
      if (rosterScrollRef.current) {
        rosterScrollRef.current.scrollTop = rosterScrollTopRef.current;
      }
    });
  }

  const roster = (
    <div>
      {!available ? (
        <p className="participant-roster-empty" role="status">
          参加者一覧を読み込めませんでした。
        </p>
      ) : items.length === 0 ? (
        <p className="participant-roster-empty">参加者はいません</p>
      ) : (
        <ul className="participant-roster-list">
          {items.map((item) => (
            <li
              className={item.isCurrentUser ? "is-current-user" : undefined}
              key={item.groupPlayerId}
            >
              <div
                aria-label={
                  item.isCurrentUser
                    ? `${item.displayName}（あなた）`
                    : undefined
                }
                className="participant-roster-row"
              >
                <button
                  aria-label={`${item.displayName}のプロフィールを見る`}
                  className="participant-roster-copy participant-player-profile"
                  onClick={() => openPlayerSnapshot(item)}
                  type="button"
                >
                  <strong>{item.displayName}</strong>
                  {item.statusText ? (
                    <small className="participant-roster-status">
                      {item.statusText}
                    </small>
                  ) : null}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <>
      {hideTrigger ? null : (
        <button
          aria-controls="participant-roster-dialog"
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          className="participant-roster-trigger"
          onClick={openSheet}
          ref={triggerRef}
          type="button"
        >
          <span>
            参加者 <strong>{countLabel}</strong>
          </span>
          <small>一覧を見る</small>
        </button>
      )}
      <dialog
        aria-labelledby="participant-roster-title"
        className="app-dialog participant-roster-dialog"
        id="participant-roster-dialog"
        onCancel={(event) => {
          event.preventDefault();
          closeSheet();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeSheet();
        }}
        onClose={handleDialogClose}
        ref={dialogRef}
      >
        <div className="participant-roster-sheet">
          <header className="participant-roster-header">
            {selectedItem ? (
              <button
                className="participant-roster-back"
                onClick={returnToRoster}
                type="button"
              >
                <IconChevronLeft aria-hidden="true" stroke={1.8} />
                <span>参加者一覧</span>
              </button>
            ) : (
              <div>
                <p className="eyebrow">PLAYERS</p>
                <h2 id="participant-roster-title">参加者 {countLabel}</h2>
              </div>
            )}
            <button
              aria-label="参加者一覧を閉じる"
              className="participant-roster-close"
              onClick={closeSheet}
              disabled={tablePending || statusPending}
              type="button"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </header>
          {selectedItem ? (
            <div className="participant-roster-scroll participant-player-detail">
              <ParticipantPlayerSnapshot
                error={selectedError}
                item={selectedItem}
                loading={quickStatsPending}
                onRetry={() => loadQuickStats(selectedItem.groupPlayerId)}
                profileHref={
                  profileBasePath
                    ? `${profileBasePath}/${selectedItem.groupPlayerId}`
                    : undefined
                }
                stats={selectedStats}
              />
              {selectedItem.isCurrentUser &&
              statusFetcher &&
              !isEditingStatus ? (
                <button
                  className="button button-secondary participant-status-edit-profile"
                  type="button"
                  onClick={startStatusEdit}
                >
                  <IconPencil aria-hidden="true" stroke={1.7} />{" "}
                  今日のひとことを編集
                </button>
              ) : null}
              {selectedItem?.isCurrentUser &&
              isEditingStatus &&
              statusFetcher ? (
                <statusFetcher.Form
                  action={statusAction}
                  className="participant-status-editor"
                  method="post"
                >
                  <input
                    name="intent"
                    type="hidden"
                    value="update-table-status"
                  />
                  <div
                    aria-label="ひとこと候補"
                    className="participant-status-presets"
                  >
                    {PARTICIPANT_STATUS_PRESETS.map((preset) => (
                      <button
                        className="participant-status-preset"
                        key={preset}
                        onClick={() => setStatusDraft(preset)}
                        type="button"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                  <label className="participant-status-field">
                    <input
                      autoFocus
                      maxLength={PARTICIPANT_TABLE_STATUS_MAX_LENGTH}
                      name="statusText"
                      onChange={(event) =>
                        setStatusDraft(event.currentTarget.value)
                      }
                      placeholder="例：今日はブラフ多め😈"
                      value={statusDraft}
                    />
                    <span className="participant-status-meta">
                      {statusLength}/{PARTICIPANT_TABLE_STATUS_MAX_LENGTH}
                    </span>
                  </label>
                  {statusFetcherData?.ok === false ? (
                    <p className="participant-status-error" role="alert">
                      {statusFetcherData.error}
                    </p>
                  ) : null}
                  <div className="participant-status-actions">
                    <button
                      className="button button-secondary"
                      disabled={statusPending}
                      onClick={cancelStatusEdit}
                      type="button"
                    >
                      キャンセル
                    </button>
                    <button
                      className="button button-primary"
                      disabled={
                        statusPending ||
                        statusLength > PARTICIPANT_TABLE_STATUS_MAX_LENGTH
                      }
                      type="submit"
                    >
                      {statusPending ? "保存中…" : "保存"}
                    </button>
                  </div>
                </statusFetcher.Form>
              ) : null}
            </div>
          ) : null}
          <div
            className="participant-roster-scroll players-management-scroll"
            ref={rosterScrollRef}
            hidden={Boolean(selectedItem)}
          >
            {tableManagement ? (
              <TableManagement
                {...tableManagement}
                embedded
                visible={isOpen}
                onRequestOpen={openSheet}
                onPendingChange={setTablePending}
                onPlayerClick={(seat) => {
                  const item = items.find(
                    (item) => item.groupPlayerId === seat.groupPlayerId,
                  );
                  openPlayerSnapshot(
                    item ?? {
                      groupPlayerId: seat.groupPlayerId,
                      displayName: seat.displayName,
                      avatarUrl: null,
                      isCurrentUser: false,
                    },
                  );
                }}
                playerDetails={(seat) => {
                  const item = items.find(
                    (item) => item.groupPlayerId === seat.groupPlayerId,
                  );
                  return item?.statusText ? (
                    <small className="participant-roster-status">
                      {item.statusText}
                    </small>
                  ) : null;
                }}
              >
                {roster}
              </TableManagement>
            ) : (
              roster
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}

export function ParticipantPlayerSnapshot({
  error,
  item,
  loading,
  onRetry,
  profileHref,
  stats,
}: {
  error: string | null;
  item: ParticipantRosterItem;
  loading: boolean;
  onRetry: () => void;
  profileHref?: string;
  stats: Extract<ParticipantQuickStatsData, { ok: true }> | null;
}) {
  const hasGames = Boolean(stats && stats.gamesPlayed > 0);
  return (
    <div className="participant-snapshot">
      <div className="participant-snapshot-identity">
        <PlayerAvatar
          avatarUrl={item.avatarUrl}
          className="participant-snapshot-avatar"
          displayName={item.displayName}
        />
        <div>
          <p className="eyebrow">PLAYER SNAPSHOT</p>
          <h2 id="participant-roster-title">{item.displayName}</h2>
          {item.statusText ? (
            <p className="participant-snapshot-status">
              <small>今日のひとこと</small>
              {item.statusText}
            </p>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="participant-snapshot-loading" role="status">
          <span aria-hidden="true" className="route-link-spinner" />
          <span>戦績を読み込み中</span>
        </div>
      ) : error ? (
        <div className="participant-snapshot-error" role="alert">
          <p>{error}</p>
          <button
            className="button button-secondary"
            onClick={onRetry}
            type="button"
          >
            もう一度読み込む
          </button>
        </div>
      ) : stats ? (
        <>
          <div className="participant-snapshot-profit">
            <span>TOTAL PROFIT</span>
            <strong className={getSnapshotBbTone(stats.totalNetBb, hasGames)}>
              {hasGames ? formatSignedBbValue(stats.totalNetBb) : "—"}
            </strong>
            <div>
              <span>直近3戦</span>
              <strong
                className={getSnapshotBbTone(
                  stats.recentThreeNetBb ?? 0,
                  stats.recentThreeNetBb !== null,
                )}
              >
                {stats.recentThreeNetBb === null
                  ? "—"
                  : formatSignedBbValue(stats.recentThreeNetBb)}
              </strong>
            </div>
          </div>
          <dl className="participant-snapshot-metrics">
            <div>
              <dt>参加回数</dt>
              <dd>{stats.gamesPlayed}戦</dd>
            </div>
            <div>
              <dt>優勝</dt>
              <dd>{stats.wins}回</dd>
            </div>
            <div>
              <dt>TOP3率</dt>
              <dd>
                {stats.gamesPlayed > 0
                  ? `${formatSnapshotPercent(stats.topThreeRate)}%`
                  : "—"}
              </dd>
            </div>
          </dl>
        </>
      ) : null}

      {profileHref ? (
        <Link
          className="participant-snapshot-profile-link"
          prefetch="intent"
          to={profileHref}
        >
          プロフィールを詳しく見る
        </Link>
      ) : null}
    </div>
  );
}

function getSnapshotBbTone(value: number, available: boolean): string {
  if (!available || value === 0) return "bb-neutral";
  return value > 0 ? "bb-positive" : "bb-negative";
}

function formatSnapshotPercent(value: number): string {
  return value.toLocaleString("ja-JP", { maximumFractionDigits: 1 });
}
