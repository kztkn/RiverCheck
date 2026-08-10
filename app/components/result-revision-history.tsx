import { formatBbScore } from "@domain/score/bb-score";
import { formatOrdinal } from "@domain/ranking/format-ordinal";
import { buildResultRevisionChanges } from "@domain/result-revision/build-result-revision-changes";
import type { GameResultRevision } from "@shared-types/result";

export function ResultRevisionHistory({
  initialChips,
  revisions,
}: {
  initialChips: number;
  revisions: GameResultRevision[];
}) {
  if (revisions.length === 0) return null;

  return (
    <section
      aria-labelledby="result-revisions-heading"
      className="result-revisions"
    >
      <div className="revision-heading">
        <div>
          <h3 id="result-revisions-heading">CORRECTION HISTORY</h3>
        </div>
        <span className="revision-status">訂正済み</span>
      </div>
      <div className="revision-list">
        {revisions.map((revision, index) => {
          const changes = buildResultRevisionChanges(
            revision.beforeResults,
            revision.afterResults,
          );
          return (
            <details
              className="revision-card"
              key={revision.id}
              open={index === 0}
            >
              <summary>
                <span>
                  <strong>第{revision.revisionNumber}回の訂正</strong>
                  <time dateTime={revision.correctedAt}>
                    {formatCorrectedAt(revision.correctedAt)}
                  </time>
                </span>
                <span>{changes.length}人に変更</span>
              </summary>
              <div className="revision-changes">
                {changes.map((change) => (
                  <article
                    className="revision-player-change"
                    key={change.groupPlayerId}
                  >
                    <strong>{change.displayName}</strong>
                    <div className="revision-change-items">
                      {change.before.remainingChips !==
                      change.after.remainingChips ? (
                        <ChangeValue
                          after={formatChips(change.after.remainingChips)}
                          before={formatChips(change.before.remainingChips)}
                          label="残りチップ"
                        />
                      ) : null}
                      {change.before.totalRebuyCount !==
                      change.after.totalRebuyCount ? (
                        <ChangeValue
                          after={formatRebuyCount(change.after.totalRebuyCount)}
                          before={formatRebuyCount(change.before.totalRebuyCount)}
                          label="累計リバイ"
                        />
                      ) : null}
                      {change.before.settlementRebuyCount !==
                      change.after.settlementRebuyCount ? (
                        <ChangeValue
                          after={String(change.after.settlementRebuyCount) + "枚"}
                          before={String(change.before.settlementRebuyCount) + "枚"}
                          label="終了時リバイ証"
                        />
                      ) : null}
                      {change.before.score !== change.after.score ? (
                        <ChangeValue
                          after={formatBbScore({
                            score: change.after.score,
                            initialChips,
                          })}
                          before={formatBbScore({
                            score: change.before.score,
                            initialChips,
                          })}
                          label="BBスコア"
                        />
                      ) : null}
                      {change.before.rank !== change.after.rank ? (
                        <ChangeValue
                          after={formatOrdinal(change.after.rank)}
                          before={formatOrdinal(change.before.rank)}
                          label="順位"
                        />
                      ) : null}
                      {change.before.costShare !== change.after.costShare ? (
                        <ChangeValue
                          after={formatYen(change.after.costShare)}
                          before={formatYen(change.before.costShare)}
                          label="会費"
                        />
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}

function ChangeValue({
  after,
  before,
  label,
}: {
  after: string;
  before: string;
  label: string;
}) {
  return (
    <div className="revision-change-value">
      <span>{label}</span>
      <span className="revision-before">{before}</span>
      <span aria-hidden="true">→</span>
      <strong>{after}</strong>
    </div>
  );
}

function formatCorrectedAt(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));
}

function formatRebuyCount(value: number | null): string {
  return value === null ? "記録なし" : String(value) + "回";
}

function formatChips(value: number): string {
  return `${value.toLocaleString("ja-JP")}チップ`;
}

function formatYen(value: number): string {
  return `${value.toLocaleString("ja-JP")}円`;
}
