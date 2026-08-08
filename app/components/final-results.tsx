import { useRef, useState } from "react";
import type { GameResultSummary } from "@shared-types/result";

export function FinalResults({
  lineText,
  results,
  shareUrl,
}: {
  lineText: string;
  results: GameResultSummary[];
  shareUrl: string;
}) {
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const [shareState, setShareState] = useState<
    "idle" | "shared" | "copied" | "fallback-copied" | "failed"
  >("idle");
  const shareText = `${lineText}\n\n結果を見る\n${shareUrl}`;

  async function copyResult(nextState: "copied" | "fallback-copied") {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareText);
      } else if (!copyWithSelection(textAreaRef.current)) {
        throw new Error("copy command was rejected");
      }
      setShareState(nextState);
    } catch {
      textAreaRef.current?.focus();
      textAreaRef.current?.select();
      setShareState("failed");
    }
  }

  async function handleShare() {
    if (!navigator.share) {
      await copyResult("fallback-copied");
      return;
    }

    try {
      await navigator.share({ text: shareText });
      setShareState("shared");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      await copyResult("fallback-copied");
    }
  }

  return (
    <section className="settlement-panel result-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">FINAL RESULTS</p>
          <h2>確定結果</h2>
        </div>
        <span className="count-badge">{results.length}人</span>
      </div>
      <div className="result-list">
        {results.map((result) => (
          <article className="result-row" key={result.groupPlayerId}>
            <span className={`rank-badge rank-${result.rank}`}>
              {result.rank}位
            </span>
            <div className="result-player">
              <strong>{result.displayName}</strong>
              <span>
                残り {formatNumber(result.remainingChips)}・リバイ
                {result.rebuyCount}回
              </span>
            </div>
            <strong className="result-score">
              {formatNumber(result.score)}点
            </strong>
            <strong className="result-cost">
              {formatNumber(result.costShare)}円
            </strong>
          </article>
        ))}
      </div>

      <div className="line-share-panel">
        <div>
          <p className="eyebrow">SHARE RESULTS</p>
          <h3>結果を共有</h3>
          <p>共有先からLINEやSNSを選べます。結果を見るリンクも一緒に送られます。</p>
        </div>
        <textarea
          aria-label="共有用結果テキスト"
          readOnly
          ref={textAreaRef}
          rows={Math.min(14, results.length + 8)}
          value={shareText}
        />
        <div className="share-actions">
          <button
            className="button button-primary"
            onClick={handleShare}
            type="button"
          >
            共有先を選ぶ
          </button>
          <button
            className="button button-secondary"
            onClick={() => copyResult("copied")}
            type="button"
          >
            {shareState === "copied" ? "コピーしました" : "結果文とリンクをコピー"}
          </button>
        </div>
        <p aria-live="polite" className="share-status">
          {shareState === "shared"
            ? "共有画面を開きました。"
            : shareState === "copied"
              ? "LINEやSNSを開いて貼り付けてください。"
              : shareState === "fallback-copied"
                ? "このブラウザでは共有画面を開けないため、結果文とリンクをコピーしました。"
                : shareState === "failed"
                  ? "自動コピーできないため、選択されたテキストを長押しでコピーしてください。"
                  : ""}
        </p>
      </div>
    </section>
  );
}

function copyWithSelection(textArea: HTMLTextAreaElement | null): boolean {
  if (!textArea) return false;
  textArea.focus();
  textArea.select();
  textArea.setSelectionRange(0, textArea.value.length);
  return document.execCommand("copy");
}

function formatNumber(value: number): string {
  return value.toLocaleString("ja-JP");
}
