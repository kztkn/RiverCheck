import { useMemo, useState } from "react";
import { Form, Link } from "react-router";
import { calculateFinalResults } from "@domain/finalization/calculate-final-results";
import { GAME_TITLE_MAX_LENGTH } from "@domain/game/game-title";
import { formatOrdinal } from "@domain/ranking/format-ordinal";
import { formatBbScore } from "@domain/score/bb-score";
import type { GameDetails } from "@shared-types/game";
import type { GameResultSummary } from "@shared-types/result";

interface CorrectionValue {
  remainingChips: string;
  rebuyCount: string;
}

export function ResultCorrectionPanel({
  cancelUrl,
  error,
  game,
  identityErrors,
  identityValues: initialIdentityValues,
  isSubmitting,
  results,
}: {
  cancelUrl: string;
  error: string | null;
  game: GameDetails;
  identityErrors: { title?: string; playedAt?: string };
  identityValues: { title: string; playedAt: string };
  isSubmitting: boolean;
  results: GameResultSummary[];
}) {
  const [values, setValues] = useState(() => initialValues(results));
  const [identityValues, setIdentityValues] = useState(initialIdentityValues);
  const [differenceConfirmed, setDifferenceConfirmed] = useState(false);

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

  const hasResultChanges = results.some((result) => {
    const value = values[result.groupPlayerId];
    return (
      value?.remainingChips !== String(result.remainingChips) ||
      value?.rebuyCount !== String(result.rebuyCount)
    );
  });
  const hasIdentityChanges =
    identityValues.title.trim() !== game.title ||
    identityValues.playedAt !== toDateInputValue(game.playedAt);
  const hasChanges = hasResultChanges || hasIdentityChanges;
  const chipDifference = preview.calculated?.chipValidation.difference ?? 0;
  const hasChipDifference = chipDifference !== 0;
  const canSubmit =
    Boolean(preview.calculated) &&
    hasChanges &&
    (!hasResultChanges || !hasChipDifference || differenceConfirmed) &&
    identityValues.title.trim().length > 0 &&
    identityValues.playedAt.length > 0 &&
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
          <h2>GAME DETAILS</h2>
        </div>
      </div>
      <p className="correction-intro">
        開催情報と結果を修正できます。結果の変更内容は参加者にも訂正履歴として表示されます。
      </p>

      <Form className="correction-form" method="post" noValidate>
        <input name="intent" type="hidden" value="correct-results" />

        <fieldset className="correction-game-details">
          <legend>GAME INFO</legend>
          <label className="field">
            <span className="field-label">開催名</span>
            <input
              aria-invalid={identityErrors.title ? true : undefined}
              maxLength={GAME_TITLE_MAX_LENGTH}
              name="title"
              onChange={(event) =>
                setIdentityValues((current) => ({
                  ...current,
                  title: event.currentTarget.value,
                }))
              }
              required
              value={identityValues.title}
            />
            {identityErrors.title ? (
              <span className="field-error">{identityErrors.title}</span>
            ) : null}
          </label>
          <label className="field">
            <span className="field-label">開催日</span>
            <input
              aria-invalid={identityErrors.playedAt ? true : undefined}
              name="playedAt"
              onChange={(event) =>
                setIdentityValues((current) => ({
                  ...current,
                  playedAt: event.currentTarget.value,
                }))
              }
              required
              type="date"
              value={identityValues.playedAt}
            />
            {identityErrors.playedAt ? (
              <span className="field-error">{identityErrors.playedAt}</span>
            ) : null}
          </label>
        </fieldset>

        <div className="correction-subheading">
          <h3>PLAYER RESULTS</h3>
        </div>
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
          <Link className="button button-secondary" to={cancelUrl}>
            Cancel
          </Link>
          <button
            className="button button-primary"
            disabled={!canSubmit}
            type="submit"
          >
            {isSubmitting ? "保存中…" : "Save Changes"}
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

function toDateInputValue(playedAt: string): string {
  return new Date(new Date(playedAt).getTime() + 9 * 60 * 60 * 1_000)
    .toISOString()
    .slice(0, 10);
}
