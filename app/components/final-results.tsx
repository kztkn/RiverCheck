import { useState } from "react";
import { Link } from "react-router";
import { formatOrdinal } from "@domain/ranking/format-ordinal";
import { formatBbScore, formatChipsPerBb } from "@domain/score/bb-score";
import type {
  GameResultRevision,
  GameResultSummary,
} from "@shared-types/result";
import { ResultRevisionHistory } from "./result-revision-history";

export function FinalResults({
  groupCode,
  lineText,
  editUrl,
  initialChips,
  playedAt,
  payPay,
  results,
  revisions,
  shareUrl,
  showSharePanel = true,
}: {
  groupCode: string;
  lineText: string;
  editUrl?: string;
  initialChips: number;
  playedAt: string;
  payPay: { link: string; paymentAmount: number | null } | null;
  results: GameResultSummary[];
  revisions: GameResultRevision[];
  shareUrl: string;
  showSharePanel?: boolean;
}) {
  const [shareState, setShareState] = useState<
    "idle" | "shared" | "fallback-copied" | "failed"
  >("idle");
  const [payPayModalOpen, setPayPayModalOpen] = useState(false);
  const [payPayCopyError, setPayPayCopyError] = useState<string | null>(null);
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
      <div className="section-heading">
        <div>
          <p className="eyebrow">FINAL RESULTS</p>
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
      <div className="result-list">
        {results.map((result) => (
          <Link
            aria-label={`${result.displayName}の戦績を見る`}
            className={`result-row result-row-rank-${result.rank}`}
            key={result.groupPlayerId}
            to={`/g/${groupCode}/stats/${result.groupPlayerId}`}
          >
            <span className={`rank-badge rank-${result.rank}`}>
              {formatOrdinal(result.rank)}
            </span>
            <div className="result-player">
              <strong>{result.displayName}</strong>
              <span>
                残り {formatNumber(result.remainingChips)}・
                {result.totalRebuyCount === null
                  ? "終了時未返済 " + result.settlementRebuyCount + "口"
                  : "リバイ " +
                    result.totalRebuyCount +
                    "回・終了時未返済 " +
                    result.settlementRebuyCount +
                    "口"}
              </span>
            </div>
            <strong
              className={`result-score result-score-${scoreTone(result.score)}`}
            >
              {formatBbScore({ score: result.score, initialChips })}
            </strong>
            <strong className="result-cost">
              {formatNumber(result.costShare)}円
            </strong>
          </Link>
        ))}
      </div>
      <div className="result-settlement-footer">
        {payPay ? (
          <button
            className="paypay-payment-button"
            onClick={() => {
              setPayPayCopyError(null);
              setPayPayModalOpen(true);
            }}
            type="button"
          >
            <span aria-hidden="true">P</span>
            PayPayで支払う
          </button>
        ) : <span />}
        <div className="result-total-summary">
          <div className="result-total">
            <span>トータル</span>
            <strong>{formatNumber(settlementTotal)}円</strong>
          </div>
          <p className="bb-basis">
            1BB = {formatChipsPerBb(initialChips)}チップ
          </p>
        </div>
      </div>
      <ResultRevisionHistory
        initialChips={initialChips}
        revisions={revisions}
      />

      {payPay && payPayModalOpen ? (
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
                  クリップボードへコピーします。<br />
                  PayPay側で金額を貼り付けてください。
                </>
              ) : (
                <>
                  この結果からあなたの支払額を特定できませんでした。<br />
                  結果画面で支払額を確認し、PayPayで金額を入力してください。
                </>
              )}
            </p>
            {payPayCopyError ? (
              <p className="error-notice" role="alert">{payPayCopyError}</p>
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

function scoreTone(score: number): "positive" | "negative" | "neutral" {
  if (score > 0) return "positive";
  if (score < 0) return "negative";
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
