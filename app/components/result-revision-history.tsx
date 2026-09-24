import { formatNetBb } from "@domain/score/bb-score";
import { formatOrdinal } from "@domain/ranking/format-ordinal";
import { buildResultRevisionChanges } from "@domain/result-revision/build-result-revision-changes";
import type { GameResultRevision } from "@shared-types/result";

export function ResultRevisionHistory({
  bbRate = 0,
  bigBlindChips,
  initialChips,
  revisions,
  showCostShareChanges = true,
}: {
  bbRate?: number;
  bigBlindChips: number;
  initialChips: number;
  revisions: GameResultRevision[];
  showCostShareChanges?: boolean;
}) {
  const visibleRevisions = revisions
    .map((revision) => ({
      revision,
      changes: buildResultRevisionChanges(
        revision.beforeResults,
        revision.afterResults,
      ).filter(
        (change) =>
          showCostShareChanges ||
          change.before.remainingChips !== change.after.remainingChips ||
          change.before.totalRebuyCount !== change.after.totalRebuyCount ||
          change.before.settlementRebuyCount !==
            change.after.settlementRebuyCount ||
          change.before.score !== change.after.score ||
          change.before.rank !== change.after.rank,
      ),
    }))
    .filter(({ changes }) => changes.length > 0);

  if (visibleRevisions.length === 0) return null;

  return (
    <section
      aria-labelledby="result-revisions-heading"
      className="result-revisions"
    >
      <div className="revision-heading">
        <div>
          <h3 id="result-revisions-heading">訂正履歴</h3>
        </div>
        <span className="revision-status">訂正済み</span>
      </div>
      <div className="revision-list">
        {visibleRevisions.map(({ revision, changes }, index) => {
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
                          before={formatRebuyCount(
                            change.before.totalRebuyCount,
                          )}
                          label="累計リバイ"
                        />
                      ) : null}
                      {change.before.settlementRebuyCount !==
                      change.after.settlementRebuyCount ? (
                        <ChangeValue
                          after={
                            String(change.after.settlementRebuyCount) + "枚"
                          }
                          before={
                            String(change.before.settlementRebuyCount) + "枚"
                          }
                          label="終了時リバイ証"
                        />
                      ) : null}
                      {change.before.score !== change.after.score ? (
                        <ChangeValue
                          after={formatNetBb({
                            score: change.after.score,
                            initialChips,
                            bigBlindChips,
                          })}
                          before={formatNetBb({
                            score: change.before.score,
                            initialChips,
                            bigBlindChips,
                          })}
                          label="損益BB"
                        />
                      ) : null}
                      {change.before.rank !== change.after.rank ? (
                        <ChangeValue
                          after={formatOrdinal(change.after.rank)}
                          before={formatOrdinal(change.before.rank)}
                          label="順位"
                        />
                      ) : null}
                      {showCostShareChanges &&
                      change.before.costShare !== change.after.costShare ? (
                        <ChangeValue
                          after={formatYen(change.after.costShare)}
                          before={formatYen(change.before.costShare)}
                          label="会費"
                        />
                      ) : null}
                      {showCostShareChanges &&
                      bbRate > 0 &&
                      (change.before.gameSettlementAmount ?? 0) !==
                        (change.after.gameSettlementAmount ?? 0) ? (
                        <ChangeValue
                          after={formatSignedYen(
                            change.after.gameSettlementAmount ?? 0,
                          )}
                          before={formatSignedYen(
                            change.before.gameSettlementAmount ?? 0,
                          )}
                          label="ゲーム"
                        />
                      ) : null}
                      {showCostShareChanges &&
                      bbRate > 0 &&
                      settlementBalance(change.before) !==
                        settlementBalance(change.after) ? (
                        <ChangeValue
                          after={formatSignedYen(
                            settlementBalance(change.after),
                          )}
                          before={formatSignedYen(
                            settlementBalance(change.before),
                          )}
                          label="最終精算"
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

function formatSignedYen(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toLocaleString("ja-JP")}円`;
}

function settlementBalance(result: {
  costShare: number;
  gameSettlementAmount?: number;
}): number {
  return (result.gameSettlementAmount ?? 0) - result.costShare;
}
