import { useMemo, useState } from "react";
import { Form, Link } from "react-router";
import { calculateFinalResults } from "@domain/finalization/calculate-final-results";
import { formatOrdinal } from "@domain/ranking/format-ordinal";
import { formatBbScore } from "@domain/score/bb-score";
import type { GameDetails } from "@shared-types/game";
import type { GameResultSummary } from "@shared-types/result";

interface CorrectionValue {
  remainingChips: string;
  totalRebuyCount: string;
  settlementRebuyCount: string;
}

export function ResultCorrectionPanel({
  actionUrl,
  cancelUrl,
  error,
  game,
  isSubmitting,
  results,
}: {
  actionUrl: string;
  cancelUrl: string;
  error: string | null;
  game: GameDetails;
  isSubmitting: boolean;
  results: GameResultSummary[];
}) {
  const [values, setValues] = useState(() => initialValues(results));
  const [differenceConfirmed, setDifferenceConfirmed] = useState(false);

  const preview = useMemo(() => {
    try {
      const participants = results.map((result) => {
        const value = values[result.groupPlayerId];
        if (!value) throw new RangeError("missing correction input");
        const totalRebuyCount = parseNonNegativeInteger(
          value.totalRebuyCount,
        );
        const settlementRebuyCount = parseNonNegativeInteger(
          value.settlementRebuyCount,
        );
        if (settlementRebuyCount > totalRebuyCount) {
          throw new RangeError("settlement exceeds total");
        }
        return {
          groupPlayerId: result.groupPlayerId,
          displayName: result.displayName,
          remainingChips: parseNonNegativeInteger(value.remainingChips),
          totalRebuyCount,
          outstandingRebuyCount: settlementRebuyCount,
          settlementRebuyCount,
        };
      });
      return {
        calculated: calculateFinalResults(game, participants),
        error: null,
      };
    } catch {
      return {
        calculated: null,
        error: "残りチップ、累計リバイ、終了時リバイ証を0以上の整数で入力してください。",
      };
    }
  }, [game, results, values]);

  const hasResultChanges = results.some((result) => {
    const value = values[result.groupPlayerId];
    return (
      value?.remainingChips !== String(result.remainingChips) ||
      value?.totalRebuyCount !==
        String(result.totalRebuyCount ?? result.settlementRebuyCount) ||
      value?.settlementRebuyCount !== String(result.settlementRebuyCount)
    );
  });
  const hasChanges = hasResultChanges;
  const chipDifference = preview.calculated?.chipValidation.difference ?? 0;
  const hasChipDifference = chipDifference !== 0;
  const canSubmit =
    hasChanges &&
    (!hasResultChanges ||
      (Boolean(preview.calculated) &&
        (!hasChipDifference || differenceConfirmed))) &&
    !isSubmitting;

  function updateValue(
    groupPlayerId: string,
    field: keyof CorrectionValue,
    value: string,
  ) {
    setValues((current) => ({
      ...current,
      [groupPlayerId]: {
        ...current[groupPlayerId]!,
        [field]: value,
      },
    }));
    setDifferenceConfirmed(false);
  }

  return (
    <section className="result-correction-panel">
      <div className="section-heading">
        <div>
          <h2>PLAYER RESULTS</h2>
        </div>
      </div>
      <p className="correction-intro">
        残りチップ、累計リバイ、終了時リバイ証を訂正します。変更内容は参加者にも訂正履歴として表示されます。
      </p>

      <Form
        action={actionUrl}
        className="correction-form"
        method="post"
        noValidate
        reloadDocument
      >
        <input name="intent" type="hidden" value="correct-results" />
        <input name="title" type="hidden" value={game.title} />
        <input name="playedAt" type="hidden" value={toDateInputValue(game.playedAt)} />

        <div className="correction-input-list">
          {results.map((result) => {
            const value = values[result.groupPlayerId]!;
            return (
              <fieldset
                className="correction-player-row"
                key={result.groupPlayerId}
              >
                <legend>{result.displayName}</legend>
                <input
                  name="groupPlayerId"
                  type="hidden"
                  value={result.groupPlayerId}
                />
                <label>
                  <span>残りチップ</span>
                  <input
                    inputMode="numeric"
                    min={0}
                    name="remainingChips"
                    onChange={(event) =>
                      updateValue(
                        result.groupPlayerId,
                        "remainingChips",
                        event.currentTarget.value,
                      )
                    }
                    required
                    type="number"
                    value={value.remainingChips}
                  />
                </label>
                <label>
                  <span>累計リバイ</span>
                  <span className="input-wrap">
                    <input
                      inputMode="numeric"
                      min={0}
                      name="totalRebuyCount"
                      onChange={(event) =>
                        updateValue(
                          result.groupPlayerId,
                          "totalRebuyCount",
                          event.currentTarget.value,
                        )
                      }
                      required
                      type="number"
                      value={value.totalRebuyCount}
                    />
                    <span className="input-suffix">回</span>
                  </span>
                </label>
                <label>
                  <span>終了時リバイ証</span>
                  <span className="input-wrap">
                    <input
                      inputMode="numeric"
                      min={0}
                      name="settlementRebuyCount"
                      onChange={(event) =>
                        updateValue(
                          result.groupPlayerId,
                          "settlementRebuyCount",
                          event.currentTarget.value,
                        )
                      }
                      required
                      type="number"
                      value={value.settlementRebuyCount}
                    />
                    <span className="input-suffix">枚</span>
                  </span>
                </label>
              </fieldset>
            );
          })}
        </div>

        <div className="correction-preview">
          <div className="section-heading">
            <div>
              <h3>RESULT PREVIEW</h3>
            </div>
            <span className="count-badge">{results.length}人</span>
          </div>
          {preview.calculated ? (
            <div className="correction-preview-list">
              {preview.calculated.results.map((result) => (
                <div
                  className="correction-preview-row"
                  key={result.groupPlayerId}
                >
                  <span>{formatOrdinal(result.rank)}</span>
                  <strong>{result.displayName}</strong>
                  <span className={scoreClassName(result.score)}>
                    {formatBbScore({
                      score: result.score,
                      initialChips: game.initialChips,
                    })}
                  </span>
                  <strong>{formatYen(result.costShare)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="warning-notice">{preview.error}</p>
          )}
        </div>

        {hasResultChanges && hasChipDifference ? (
          <label className="confirmation-box difference-warning">
            <input
              checked={differenceConfirmed}
              name="confirmDifference"
              onChange={(event) =>
                setDifferenceConfirmed(event.currentTarget.checked)
              }
              type="checkbox"
              value="yes"
            />
            <span className="confirmation-copy">
              <strong>
                チップ差分 {formatSignedNumber(chipDifference)} を確認しました
              </strong>
              <small>
                差分がある状態で訂正する場合は、内容を確認してチェックしてください。
              </small>
            </span>
          </label>
        ) : null}

        {!hasChanges ? (
          <p className="correction-hint">変更する値を入力してください。</p>
        ) : null}
        {error ? (
          <p className="finalize-error" role="alert">
            <span aria-hidden="true">!</span>
            {error}
          </p>
        ) : null}

        <div className="correction-actions">
          <Link className="button button-secondary" to={cancelUrl}>
            Cancel
          </Link>
          <button
            className="button button-primary"
            disabled={!canSubmit}
            type="submit"
          >
            {isSubmitting ? "保存中…" : "Save"}
          </button>
        </div>
      </Form>
    </section>
  );
}

function initialValues(
  results: GameResultSummary[],
): Record<string, CorrectionValue> {
  return Object.fromEntries(
    results.map((result) => [
      result.groupPlayerId,
      {
        remainingChips: String(result.remainingChips),
        totalRebuyCount: String(
          result.totalRebuyCount ?? result.settlementRebuyCount,
        ),
        settlementRebuyCount: String(result.settlementRebuyCount),
      },
    ]),
  );
}

function parseNonNegativeInteger(value: string): number {
  if (!/^\d+$/.test(value.trim())) throw new RangeError("invalid integer");
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new RangeError("unsafe integer");
  return parsed;
}

function scoreClassName(score: number): string {
  return score > 0
    ? "result-score-positive"
    : score < 0
      ? "result-score-negative"
      : "result-score-neutral";
}

function formatYen(value: number): string {
  return `${value.toLocaleString("ja-JP")}円`;
}

function formatSignedNumber(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("ja-JP")}`;
}

function toDateInputValue(playedAt: string): string {
  return new Date(new Date(playedAt).getTime() + 9 * 60 * 60 * 1_000)
    .toISOString()
    .slice(0, 10);
}
