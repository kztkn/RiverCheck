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
  lineText,
  editUrl,
  initialChips,
  playedAt,
  results,
  revisions,
  shareUrl,
  showSharePanel = true,
}: {
  lineText: string;
  editUrl?: string;
  initialChips: number;
  playedAt: string;
  results: GameResultSummary[];
  revisions: GameResultRevision[];
  shareUrl: string;
  showSharePanel?: boolean;
}) {
  const [shareState, setShareState] = useState<
    "idle" | "shared" | "fallback-copied" | "failed"
  >("idle");
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
          <article className="result-row" key={result.groupPlayerId}>
            <span className={`rank-badge rank-${result.rank}`}>
              {formatOrdinal(result.rank)}
            </span>
            <div className="result-player">
              <strong>{result.displayName}</strong>
              <span>
                残り {formatNumber(result.remainingChips)}・リバイ
                {result.rebuyCount}回
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
          </article>
        ))}
      </div>
      <div className="result-total">
        <span>トータル</span>
        <strong>{formatNumber(settlementTotal)}円</strong>
      </div>

      <p className="bb-basis">
        1BB = {formatChipsPerBb(initialChips)}チップ
      </p>
      <ResultRevisionHistory
        initialChips={initialChips}
        revisions={revisions}
      />
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
