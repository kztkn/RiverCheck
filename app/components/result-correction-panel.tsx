import { useEffect, useMemo, useState } from "react";
import { Form } from "react-router";
import { calculateFinalResults } from "@domain/finalization/calculate-final-results";
import { formatBbScore } from "@domain/score/bb-score";
import type { GameDetails } from "@shared-types/game";
import type { GameResultSummary } from "@shared-types/result";

interface CorrectionValue {
  remainingChips: string;
  rebuyCount: string;
}

export function ResultCorrectionPanel({
  error,
  game,
  isSubmitting,
  results,
}: {
  error: string | null;
  game: GameDetails;
  isSubmitting: boolean;
  results: GameResultSummary[];
}) {
  const [isEditing, setIsEditing] = useState(Boolean(error));
  const [values, setValues] = useState(() => initialValues(results));
  const [differenceConfirmed, setDifferenceConfirmed] = useState(false);

  useEffect(() => {
    if (error) setIsEditing(true);
  }, [error]);

  const preview = useMemo(() => {
    try {
      const participants = results.map((result) => {
        const value = values[result.groupPlayerId];
        if (!value) throw new RangeError("missing correction input");
        return {
          groupPlayerId: result.groupPlayerId,
          displayName: result.displayName,
          remainingChips: parseNonNegativeInteger(value.remainingChips),
          rebuyCount: parseNonNegativeInteger(value.rebuyCount),
        };
      });
      return {
        calculated: calculateFinalResults(game, participants),
        error: null,
      };
    } catch {
      return {
        calculated: null,
        error: "残りチップとリバイ回数を0以上の整数で入力してください。",
      };
    }
  }, [game, results, values]);

  const hasChanges = results.some((result) => {
    const value = values[result.groupPlayerId];
    return (
      value?.remainingChips !== String(result.remainingChips) ||
      value?.rebuyCount !== String(result.rebuyCount)
    );
  });
  const chipDifference = preview.calculated?.chipValidation.difference ?? 0;
  const hasChipDifference = chipDifference !== 0;
  const canSubmit =
    Boolean(preview.calculated) &&
    hasChanges &&
    (!hasChipDifference || differenceConfirmed) &&
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

  function cancelEditing() {
    setValues(initialValues(results));
    setDifferenceConfirmed(false);
    setIsEditing(false);
  }

  if (!isEditing) {
    return (
      <section className="result-correction-entry">
        <div>
          <h2>結果に入力ミスがありましたか？</h2>
          <p>
            確定状態を保ったまま、残りチップとリバイ回数を訂正できます。
          </p>
        </div>
        <button
          className="button button-secondary"
          onClick={() => setIsEditing(true)}
          type="button"
        >
          結果を修正
        </button>
      </section>
    );
  }

  return (
    <section className="result-correction-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">CORRECT RESULTS</p>
          <h2>確定結果を訂正</h2>
        </div>
        <span className="status status-finalized">確定済みのまま</span>
      </div>
      <p className="correction-intro">
        訂正後の順位・BB・会費を確認してから保存します。変更内容は参加者にも履歴として表示されます。
      </p>

      <Form className="correction-form" method="post" noValidate>
        <input name="intent" type="hidden" value="correct-results" />
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
                  <span>リバイ</span>
                  <span className="input-wrap">
                    <input
                      inputMode="numeric"
                      min={0}
                      name="rebuyCount"
                      onChange={(event) =>
                        updateValue(
                          result.groupPlayerId,
                          "rebuyCount",
                          event.currentTarget.value,
                        )
                      }
                      required
                      type="number"
                      value={value.rebuyCount}
                    />
                    <span className="input-suffix">回</span>
                  </span>
                </label>
              </fieldset>
            );
          })}
        </div>

        <div className="correction-preview">
          <div className="section-heading">
            <div>
              <p className="eyebrow">PREVIEW</p>
              <h3>訂正後の結果</h3>
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
                  <span>{result.rank}位</span>
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

        {hasChipDifference ? (
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
          <button
            className="button button-secondary"
            disabled={isSubmitting}
            onClick={cancelEditing}
            type="button"
          >
            ✕
          </button>
          <button
            className="button button-primary"
            disabled={!canSubmit}
            type="submit"
          >
            {isSubmitting ? "訂正中…" : "この内容で訂正する"}
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
        rebuyCount: String(result.rebuyCount),
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
