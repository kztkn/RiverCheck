import { useEffect, useMemo, useState } from "react";
import { calculateCostShares } from "@domain/cost-sharing/calculate-cost-shares";
import {
  recommendTopCosts,
  recommendTopCostsForAttendance,
} from "@domain/cost-sharing/recommend-top-costs";

export interface GameSettingsValues {
  title: string;
  playedAt: string;
  initialChips: string;
  venueCost: string;
  firstPlaceCost: string;
  secondPlaceCost: string;
  thirdPlaceCost: string;
  previewParticipantCount: string;
}

type SettingsErrors = Partial<Record<keyof GameSettingsValues, string>>;

interface GameSettingsFieldsProps {
  actualParticipantCount?: number;
  errors: SettingsErrors;
  showCoreSettings?: boolean;
  values: GameSettingsValues;
}

export function GameSettingsFields({
  actualParticipantCount = 0,
  errors,
  showCoreSettings = true,
  values,
}: GameSettingsFieldsProps) {
  const [costValues, setCostValues] = useState(() => ({
    venueCost: values.venueCost,
    firstPlaceCost: values.firstPlaceCost,
    secondPlaceCost: values.secondPlaceCost,
    thirdPlaceCost: values.thirdPlaceCost,
  }));
  const [participantCount, setParticipantCount] = useState(
    Math.max(4, Number(values.previewParticipantCount) || 4),
  );
  const [recommendationNotice, setRecommendationNotice] = useState<
    string | null
  >(null);

  useEffect(() => {
    setParticipantCount(
      Math.max(4, Number(values.previewParticipantCount) || 4),
    );
  }, [values.previewParticipantCount]);

  const preview = useMemo(() => {
    try {
      const input = {
        venueCost: parsePreviewInteger(costValues.venueCost),
        participantCount,
        firstPlaceCost: parsePreviewInteger(costValues.firstPlaceCost),
        secondPlaceCost: parsePreviewInteger(costValues.secondPlaceCost),
        thirdPlaceCost: parsePreviewInteger(costValues.thirdPlaceCost),
      };
      return { result: calculateCostShares(input), error: null };
    } catch {
      return {
        result: null,
        error:
          "設定不可です。1〜3位を100円単位かつ順位順の金額にし、4位以下へ3位額を保証できる会場費にしてください。",
      };
    }
  }, [costValues, participantCount]);

  const recommendation = useMemo(() => {
    try {
      return recommendTopCosts(
        parsePreviewInteger(costValues.venueCost),
        participantCount,
      );
    } catch {
      return null;
    }
  }, [costValues.venueCost, participantCount]);

  function setCost(name: keyof typeof costValues, value: string) {
    setRecommendationNotice(null);
    setCostValues((current) => ({ ...current, [name]: value }));
  }

  function applyRecommendation() {
    let adjusted;
    try {
      adjusted = recommendTopCostsForAttendance(
        parsePreviewInteger(costValues.venueCost),
        participantCount,
        actualParticipantCount,
      );
    } catch {
      return;
    }
    setParticipantCount(adjusted.participantCount);
    setCostValues((current) => ({
      ...current,
      firstPlaceCost: String(adjusted.firstPlaceCost),
      secondPlaceCost: String(adjusted.secondPlaceCost),
      thirdPlaceCost: String(adjusted.thirdPlaceCost),
    }));
    setRecommendationNotice(
      adjusted.adjustedToAttendance
        ? `参加状況${actualParticipantCount}人に合わせて計算しました。`
        : `${adjusted.participantCount}人想定のおすすめ値を反映しました。`,
    );
  }

  return (
    <>
      {showCoreSettings ? (
        <>
          <fieldset className="form-section">
            <legend>
              <span>01</span>
              基本情報
            </legend>
            <Field
              defaultValue={values.title}
              error={errors.title}
              label="開催名"
              name="title"
              placeholder="例：8月のポーカー会"
              required
            />
            <Field
              defaultValue={values.playedAt}
              error={errors.playedAt}
              label="開催日"
              name="playedAt"
              required
              type="date"
            />
          </fieldset>

          <fieldset className="form-section">
            <legend>
              <span>02</span>
              チップ設定
            </legend>
            <Field
              defaultValue={values.initialChips}
              error={errors.initialChips}
              inputMode="numeric"
              label="初期チップ（100BB）"
              name="initialChips"
              required
              type="number"
            />
            <p className="field-hint">
              リバイでも初期チップと同じ枚数を追加します。
            </p>
          </fieldset>
        </>
      ) : null}

      <fieldset className="form-section">
        <legend>
          <span>03</span>
          会場費の精算
        </legend>
        <Field
          error={errors.venueCost}
          inputMode="numeric"
          label="会場費"
          name="venueCost"
          onChange={(event) => setCost("venueCost", event.target.value)}
          placeholder="5665"
          required
          suffix="円"
          type="number"
          value={costValues.venueCost}
        />
        <p className="field-hint">
          精算総額は100円単位で切り上げます。4位以下は3位と同額以上です。
        </p>
        <div className="field-grid field-grid-three">
          <Field
            error={errors.firstPlaceCost}
            inputMode="numeric"
            label="🥇 1位"
            name="firstPlaceCost"
            onChange={(event) => setCost("firstPlaceCost", event.target.value)}
            required
            suffix="円"
            type="number"
            value={costValues.firstPlaceCost}
          />
          <Field
            error={errors.secondPlaceCost}
            inputMode="numeric"
            label="🥈 2位"
            name="secondPlaceCost"
            onChange={(event) => setCost("secondPlaceCost", event.target.value)}
            required
            suffix="円"
            type="number"
            value={costValues.secondPlaceCost}
          />
          <Field
            error={errors.thirdPlaceCost}
            inputMode="numeric"
            label="🥉 3位"
            name="thirdPlaceCost"
            onChange={(event) => setCost("thirdPlaceCost", event.target.value)}
            required
            suffix="円"
            type="number"
            value={costValues.thirdPlaceCost}
          />
        </div>

        <section className="cost-preview" aria-live="polite">
          <div className="cost-preview-heading">
            <div>
              <p className="eyebrow">LIVE PREVIEW</p>
              <h2>順位別の負担額</h2>
            </div>
            <label className="preview-count">
              <span>想定人数</span>
              <input
                inputMode="numeric"
                aria-invalid={Boolean(errors.previewParticipantCount)}
                min={4}
                name="previewParticipantCount"
                onChange={(event) => {
                  setRecommendationNotice(null);
                  setParticipantCount(
                    Math.max(4, Number(event.target.value) || 4),
                  );
                }}
                type="number"
                value={participantCount}
              />
              <span>人</span>
            </label>
          </div>

          {errors.previewParticipantCount ? (
            <p className="preview-error">{errors.previewParticipantCount}</p>
          ) : null}

          {recommendation ? (
            <div className="recommendation-card">
              <div>
                <p className="recommendation-title">
                  なだらか配分のおすすめ
                </p>
                <p>
                  1位 {formatYen(recommendation.firstPlaceCost)}・2位{" "}
                  {formatYen(recommendation.secondPlaceCost)}・3位{" "}
                  {formatYen(recommendation.thirdPlaceCost)}
                </p>
                <small>
                  この設定なら最下位は{" "}
                  {formatYen(recommendation.shares.at(-1) ?? 0)}です。
                </small>
                {recommendationNotice ? (
                  <small className="recommendation-notice">
                    {recommendationNotice}
                  </small>
                ) : null}
              </div>
              <button
                className="button button-small button-secondary"
                onClick={applyRecommendation}
                type="button"
              >
                おすすめ値を反映
              </button>
            </div>
          ) : null}

          {preview.result ? (
            <>
              <div className="share-grid">
                {preview.result.shares.map((share, index) => (
                  <div className="share-item" key={index}>
                    <span>{index + 1}位</span>
                    <strong>{formatYen(share)}</strong>
                  </div>
                ))}
              </div>
              <div className="preview-totals">
                <span>
                  精算総額{" "}
                  <strong>{formatYen(preview.result.settlementTotal)}</strong>
                </span>
                <span>
                  負担額合計{" "}
                  <strong>
                    {formatYen(
                      preview.result.shares.reduce(
                        (sum, share) => sum + share,
                        0,
                      ),
                    )}
                  </strong>
                </span>
              </div>
            </>
          ) : (
            <p className="preview-error">{preview.error}</p>
          )}
        </section>
      </fieldset>
    </>
  );
}

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label: string;
  name: string;
  suffix?: string;
}

export function Field({
  error,
  label,
  name,
  suffix,
  ...inputProps
}: FieldProps) {
  const errorId = `${name}-error`;
  return (
    <label className="field" htmlFor={name}>
      <span className="field-label">{label}</span>
      <span className="input-wrap">
        <input
          {...inputProps}
          aria-describedby={error ? errorId : undefined}
          aria-invalid={Boolean(error)}
          id={name}
          min={inputProps.type === "number" ? 0 : undefined}
          name={name}
        />
        {suffix ? <span className="input-suffix">{suffix}</span> : null}
      </span>
      {error ? (
        <span className="field-error" id={errorId}>
          {error}
        </span>
      ) : null}
    </label>
  );
}

function parsePreviewInteger(value: string): number {
  if (!/^\d+$/.test(value.trim())) throw new RangeError("invalid integer");
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new RangeError("unsafe integer");
  return parsed;
}

function formatYen(value: number): string {
  return `${new Intl.NumberFormat("ja-JP").format(value)}円`;
}
