import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { formatOrdinal } from "@domain/ranking/format-ordinal";
import {
  calculateNetBb,
  formatChipsPerBb,
  formatNetBb,
} from "@domain/score/bb-score";
import type {
  GameResultRevision,
  GameResultSummary,
} from "@shared-types/result";
import { ResultRevisionHistory } from "./result-revision-history";
import { PlayerAvatar } from "./player-avatar";

export function FinalResults({
  groupCode,
  lineText,
  editUrl,
  bbRate = 0,
  initialChips,
  bigBlindChips,
  initialStackBb = 100,
  linkPlayerProfiles = true,
  playedAt,
  payPay,
  results,
  revisions,
  shareUrl,
  showSettlementAmounts = true,
  showSharePanel = true,
}: {
  groupCode: string;
  lineText: string;
  editUrl?: string;
  bbRate?: number;
  initialChips: number;
  bigBlindChips: number;
  initialStackBb?: number;
  linkPlayerProfiles?: boolean;
  playedAt: string;
  payPay: {
    link: string;
    paymentAmount: number | null;
    paymentAvailable: boolean;
    ownerDisplayName: string | null;
    ownerGroupPlayerId: string | null;
  } | null;
  results: Array<GameResultSummary & { avatarUrl?: string | null }>;
  revisions: GameResultRevision[];
  shareUrl: string;
  showSettlementAmounts?: boolean;
  showSharePanel?: boolean;
}) {
  const [shareState, setShareState] = useState<
    "idle" | "shared" | "fallback-copied" | "failed"
  >("idle");
  const [payPayModalOpen, setPayPayModalOpen] = useState(false);
  const [payPayCopyError, setPayPayCopyError] = useState<string | null>(null);
  const winner = results.find((result) => result.rank === 1) ?? null;
  const shareText = `${lineText}\n\n結果を見る\n${shareUrl}`;
  const settlementTotal = results.reduce(
    (total, result) => total + result.costShare,
    0,
  );

  async function copyResultFallback() {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareText);
      } else if (!copyWithTemporaryTextarea(shareText)) {
        throw new Error("copy command was rejected");
      }
      setShareState("fallback-copied");
    } catch {
      setShareState("failed");
    }
  }

  async function handleShare() {
    if (!navigator.share) {
      await copyResultFallback();
      return;
    }

    try {
      await navigator.share({ text: shareText });
      setShareState("shared");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      await copyResultFallback();
    }
  }

  async function handleOpenPayPay() {
    if (!payPay) return;
    if (payPay.paymentAmount !== null) {
      try {
        const amount = String(payPay.paymentAmount);
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(amount);
        } else if (!copyWithTemporaryTextarea(amount)) {
          throw new Error("copy command was rejected");
        }
      } catch {
        setPayPayCopyError(
          "金額をコピーできませんでした。ブラウザの設定を確認して、もう一度お試しください。",
        );
        return;
      }
    }

    const opened = window.open(payPay.link, "_blank");
    if (opened) {
      opened.opener = null;
    } else {
      window.location.assign(payPay.link);
    }
    setPayPayModalOpen(false);
  }

  return (
    <section className="settlement-panel result-panel">
      <div className="section-heading result-heading">
        <div>
          <p className="form-brand-label">FINAL RESULTS</p>
          <h2>確定結果</h2>
          <time className="result-played-at" dateTime={playedAt}>
            {formatPlayedAt(playedAt)}
          </time>
        </div>
        <div className="result-heading-actions">
          <span className="count-badge">{results.length}人</span>
          {showSharePanel ? (
            <button
              aria-label="結果を共有"
              className="result-action-button"
              onClick={handleShare}
              title="Share Results"
              type="button"
            >
              <ShareIcon />
            </button>
          ) : null}
          {editUrl ? (
            <Link
              aria-label="開催情報と結果を編集"
              className="result-action-button"
              title="Edit Game"
              to={editUrl}
            >
              <EditIcon />
            </Link>
          ) : null}
        </div>
      </div>
      {showSharePanel && shareState !== "idle" ? (
        <p aria-live="polite" className="result-action-status">
          {shareState === "shared"
            ? "共有画面を開きました。"
            : shareState === "fallback-copied"
              ? "結果文とリンクをコピーしました。"
              : "このブラウザでは共有またはコピーを利用できません。"}
        </p>
      ) : null}
      {winner ? (
        <ResultPlayerContainer
          ariaLabel={`${winner.displayName}の戦績を見る`}
          className="result-winner"
          groupCode={groupCode}
          groupPlayerId={winner.groupPlayerId}
          link={linkPlayerProfiles}
        >
          <div className="result-winner-copy">
            <span>WINNER</span>
            <div className="result-winner-identity">
              <PlayerAvatar
                avatarUrl={winner.avatarUrl ?? null}
                className="result-avatar result-winner-avatar"
                displayName={winner.displayName}
              />
              <div className="result-winner-person">
                <strong>
                  {winner.displayName}
                  {payPay?.ownerGroupPlayerId === winner.groupPlayerId ? (
                    <span aria-label="PayPay受取人" className="paypay-owner-mark" title="PayPay受取人">☆</span>
                  ) : null}
                </strong>
                <ResultParticipantMeta result={winner} />
              </div>
            </div>
          </div>
          <div className="result-values result-winner-values">
            <b
              className={`result-score result-score-${scoreTone(winner.score, initialChips, bigBlindChips)}`}
            >
              {formatNetBb({
                score: winner.score,
                initialChips,
                bigBlindChips,
              })}
            </b>
            {showSettlementAmounts ? (
              <ResultSettlementAmount bbRate={bbRate} result={winner} />
            ) : null}
          </div>
        </ResultPlayerContainer>
      ) : null}
      <div className="result-list">
        {results
          .filter((result) => result.rank !== 1)
          .map((result) => (
            <ResultPlayerContainer
              ariaLabel={`${result.displayName}の戦績を見る`}
              className={`result-row result-row-rank-${result.rank}${
                result.rank <= 3 ? " is-top-three" : ""
              }`}
              groupCode={groupCode}
              groupPlayerId={result.groupPlayerId}
              key={result.groupPlayerId}
              link={linkPlayerProfiles}
            >
              <span className={`rank-badge rank-${result.rank}`}>
                {formatOrdinal(result.rank)}
              </span>
              <PlayerAvatar
                avatarUrl={result.avatarUrl ?? null}
                className="result-avatar"
                displayName={result.displayName}
              />
              <div className="result-player">
                <strong>
                  {result.displayName}
                  {payPay?.ownerGroupPlayerId === result.groupPlayerId ? (
                    <span aria-label="PayPay受取人" className="paypay-owner-mark" title="PayPay受取人">☆</span>
                  ) : null}
                </strong>
                <ResultParticipantMeta result={result} />
              </div>
              <div className="result-values">
                <strong
                  className={`result-score result-score-${scoreTone(result.score, initialChips, bigBlindChips)}`}
                >
                  {formatNetBb({
                    score: result.score,
                    initialChips,
                    bigBlindChips,
                  })}
                </strong>
                {showSettlementAmounts ? (
                  <ResultSettlementAmount bbRate={bbRate} result={result} />
                ) : null}
              </div>
            </ResultPlayerContainer>
          ))}
      </div>
      <div className="result-settlement-footer">
        {payPay?.paymentAvailable ? (
          <button
            className="paypay-payment-button"
            onClick={() => {
              setPayPayCopyError(null);
              setPayPayModalOpen(true);
            }}
            type="button"
          >
            <span aria-hidden="true">P</span>
            {payPay.ownerDisplayName
              ? `${payPay.ownerDisplayName}に送金`
              : "PayPayで支払う"}
          </button>
        ) : (
          <span />
        )}
        <div className="result-total-summary">
          {showSettlementAmounts ? (
            <div className="result-total">
              <span>負担合計</span>
              <strong>{formatNumber(settlementTotal)}P</strong>
            </div>
          ) : null}
          <p className="bb-basis">
            {initialStackBb}BB開始 ・ 1BB = {formatChipsPerBb(bigBlindChips)}
            チップ
          </p>
          {bbRate > 0 ? (
            <p className="bb-basis">
              ゲーム結果 1BB = {formatNumber(bbRate)}P
            </p>
          ) : null}
        </div>
      </div>
      <ResultRevisionHistory
        bbRate={bbRate}
        bigBlindChips={bigBlindChips}
        initialChips={initialChips}
        revisions={revisions}
        showCostShareChanges={showSettlementAmounts}
      />

      {payPay?.paymentAvailable && payPayModalOpen ? (
        <section
          aria-label="PayPayで支払う"
          aria-modal="true"
          className="paypay-payment-modal"
          role="dialog"
        >
          <button
            aria-label="PayPay支払いを閉じる"
            className="paypay-payment-modal-backdrop"
            onClick={() => setPayPayModalOpen(false)}
            type="button"
          />
          <div className="paypay-payment-modal-card">
            <div>
              <p className="eyebrow">PAYPAY</p>
              <h2>PayPayで支払う</h2>
            </div>
            <p className="paypay-payment-recipient">
              {payPay.ownerDisplayName
                ? `${payPay.ownerDisplayName}に送金します`
                : "送金先の名前は未設定です。リンク先を確認してください。"}
            </p>
            {payPay.paymentAmount !== null ? (
              <div className="paypay-payment-amount">
                <span>あなたの支払額</span>
                <strong>{formatNumber(payPay.paymentAmount)}円</strong>
              </div>
            ) : null}
            <p className="paypay-payment-copy">
              {payPay.paymentAmount !== null ? (
                <>
                  PayPayを開く際に{formatNumber(payPay.paymentAmount)}円を
                  クリップボードへコピーします。
                  <br />
                  PayPay側で金額を貼り付けてください。
                </>
              ) : (
                <>
                  この結果からあなたの支払額を特定できませんでした。
                  <br />
                  結果画面で支払額を確認し、PayPayで金額を入力してください。
                </>
              )}
            </p>
            {payPayCopyError ? (
              <p className="error-notice" role="alert">
                {payPayCopyError}
              </p>
            ) : null}
            <div className="paypay-payment-modal-actions">
              <button
                className="button button-secondary"
                onClick={() => setPayPayModalOpen(false)}
                type="button"
              >
                キャンセル
              </button>
              <button
                className="button paypay-open-button"
                onClick={() => void handleOpenPayPay()}
                type="button"
              >
                PayPayを開く
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </section>
  );
}

function ResultSettlementAmount({
  bbRate,
  result,
}: {
  bbRate: number;
  result: GameResultSummary;
}) {
  if (bbRate === 0) {
    return (
      <strong className="result-cost">
        {formatNumber(result.costShare)}P
      </strong>
    );
  }

  const gameAmount = result.gameSettlementAmount ?? 0;
  const balance = gameAmount - result.costShare;
  return (
    <span className="result-settlement-amount">
      <strong className={`result-cost result-cost-${settlementTone(balance)}`}>
        {formatSignedPoints(balance)}
      </strong>
      <small>
        ゲーム {formatSignedPoints(gameAmount)} / 負担 -
        {formatNumber(result.costShare)}P
      </small>
    </span>
  );
}

function settlementTone(value: number): "positive" | "negative" | "neutral" {
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "neutral";
}

function formatSignedPoints(value: number): string {
  return `${value > 0 ? "+" : ""}${formatNumber(value)}P`;
}

function ResultParticipantMeta({ result }: { result: GameResultSummary }) {
  return (
    <div className="result-participant-meta">
      <span className="result-final-stack">
        最終スタック <strong>{formatNumber(result.remainingChips)}</strong>
      </span>
      <span className="result-rebuy-meta">
        リバイ{" "}
        {result.totalRebuyCount === null
          ? "記録なし"
          : `${result.totalRebuyCount}回`}
        <span aria-hidden="true">・</span>
        終了時未返済 {result.settlementRebuyCount}口
      </span>
    </div>
  );
}
function scoreTone(
  score: number,
  initialChips: number,
  bigBlindChips: number,
): "positive" | "negative" | "neutral" {
  const netBb = calculateNetBb({ score, initialChips, bigBlindChips });
  if (netBb > 0) return "positive";
  if (netBb < 0) return "negative";
  return "neutral";
}

function copyWithTemporaryTextarea(text: string): boolean {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.readOnly = true;
  textArea.style.position = "fixed";
  textArea.style.inset = "0 auto auto -9999px";
  textArea.style.fontSize = "16px";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  const copied = document.execCommand("copy");
  textArea.remove();
  return copied;
}

function ShareIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 16V3m0 0L7.5 7.5M12 3l4.5 4.5" />
      <path d="M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m4 20 4.2-1 10.6-10.6a2.1 2.1 0 0 0-3-3L5.2 16 4 20Z" />
      <path d="m14.5 6.7 2.8 2.8" />
    </svg>
  );
}

function formatPlayedAt(playedAt: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "long",
    timeZone: "Asia/Tokyo",
  }).format(new Date(playedAt));
}

function formatNumber(value: number): string {
  return value.toLocaleString("ja-JP");
}

function ResultPlayerContainer({
  ariaLabel,
  children,
  className,
  groupCode,
  groupPlayerId,
  link,
}: {
  ariaLabel: string;
  children: ReactNode;
  className: string;
  groupCode: string;
  groupPlayerId: string;
  link: boolean;
}) {
  return link ? (
    <Link
      aria-label={ariaLabel}
      className={className}
      to={`/g/${groupCode}/stats/${groupPlayerId}`}
    >
      {children}
    </Link>
  ) : (
    <div className={className}>{children}</div>
  );
}
