import { useMemo, useState } from "react";
import {
  recommendChipDistribution,
  type ChipDistributionRecommendation,
  type ChipDistributionResult,
} from "@domain/chip-distribution/recommend-chip-distribution";
import {
  calculateInitialStackBb,
  formatChipValue,
  INITIAL_STACK_BB_OPTIONS,
} from "@domain/score/bb-score";

export interface GameConfigurationValues {
  initialChips: string;
  smallBlindChips: string;
  bigBlindChips: string;
  bigBlindAnteChips: string;
}

export type GameConfigurationErrors = Partial<
  Record<keyof GameConfigurationValues, string>
>;

export function GameConfigurationFields({
  errors = {},
  onChange,
  values,
}: {
  errors?: GameConfigurationErrors;
  onChange: (next: GameConfigurationValues) => void;
  values: GameConfigurationValues;
}) {
  const initialStackBb = useMemo(() => {
    try {
      return calculateInitialStackBb(
        Number(values.initialChips),
        Number(values.bigBlindChips),
      );
    } catch {
      return null;
    }
  }, [values.bigBlindChips, values.initialChips]);

  function update(field: keyof GameConfigurationValues, value: string) {
    onChange({ ...values, [field]: value });
  }

  function applyStackDepth(stackBb: number) {
    const bigBlindChips = Number(values.bigBlindChips);
    const initialChips = bigBlindChips * stackBb;
    if (!Number.isSafeInteger(initialChips) || initialChips <= 0) return;
    update("initialChips", String(initialChips));
  }

  return (
    <>
      <label className="field">
        <span className="field-label">初期チップ</span>
        <input
          aria-invalid={errors.initialChips ? true : undefined}
          inputMode="numeric"
          min={1}
          name="initialChips"
          onChange={(event) => update("initialChips", event.target.value)}
          required
          type="number"
          value={values.initialChips}
        />
        {errors.initialChips ? (
          <span className="field-error">{errors.initialChips}</span>
        ) : null}
      </label>

      <div className="blind-input-grid">
        <BlindInput
          error={errors.smallBlindChips}
          label="SB"
          name="smallBlindChips"
          onChange={(value) => update("smallBlindChips", value)}
          value={values.smallBlindChips}
        />
        <BlindInput
          error={errors.bigBlindChips}
          label="BB"
          name="bigBlindChips"
          onChange={(value) => update("bigBlindChips", value)}
          value={values.bigBlindChips}
        />
        <BlindInput
          error={errors.bigBlindAnteChips}
          label="BBA"
          min={0}
          name="bigBlindAnteChips"
          onChange={(value) => update("bigBlindAnteChips", value)}
          value={values.bigBlindAnteChips}
        />
      </div>

      <div aria-live="polite" className="blind-structure-preview">
        <div className="blind-structure-heading">
          <span>今回のゲーム設定</span>
          <small>SB / BB / BBA</small>
        </div>
        {initialStackBb === null ? (
          <p>初期チップがBBの整数倍になるように設定してください。</p>
        ) : (
          <>
            <div className="blind-structure-values">
              <span>
                <small>SB</small>
                <strong>{formatInputChip(values.smallBlindChips)}</strong>
              </span>
              <span>
                <small>BB</small>
                <strong>{formatInputChip(values.bigBlindChips)}</strong>
              </span>
              <span>
                <small>BBA</small>
                <strong>{formatInputChip(values.bigBlindAnteChips)}</strong>
              </span>
            </div>
            <p>
              開始スタック <strong>{initialStackBb}BB</strong> ・ 1BB ={" "}
              {formatInputChip(values.bigBlindChips)}チップ
            </p>
          </>
        )}
      </div>

      <div
        className="initial-stack-shortcuts"
        aria-label="開始スタックのショートカット"
      >
        <span>スタック深度を変更</span>
        <div className="initial-stack-options">
          {INITIAL_STACK_BB_OPTIONS.map((stackBb) => (
            <button
              aria-pressed={initialStackBb === stackBb}
              className="initial-stack-option"
              key={stackBb}
              onClick={() => applyStackDepth(stackBb)}
              type="button"
            >
              {stackBb}BB
            </button>
          ))}
        </div>
        <small>BBは変えず、初期チップだけを調整します。</small>
      </div>

      <ChipDistributionCalculator
        onApply={(recommendation) =>
          onChange(gameConfigurationFromRecommendation(recommendation))
        }
      />
    </>
  );
}

export function calculateChipDistributionFromInputs(
  inputs: string[],
): ChipDistributionResult {
  const populated = inputs.map((value) => value.trim()).filter(Boolean);
  const denominations = populated.map(Number);
  return recommendChipDistribution(denominations);
}

export function gameConfigurationFromRecommendation(
  recommendation: ChipDistributionRecommendation,
): GameConfigurationValues {
  return {
    initialChips: String(recommendation.initialChips),
    smallBlindChips: String(recommendation.smallBlindChips),
    bigBlindChips: String(recommendation.bigBlindChips),
    bigBlindAnteChips: String(recommendation.bigBlindAnteChips),
  };
}

function ChipDistributionCalculator({
  onApply,
}: {
  onApply: (recommendation: ChipDistributionRecommendation) => void;
}) {
  const [rows, setRows] = useState(() => [
    { id: 1, value: "10000" },
    { id: 2, value: "5000" },
    { id: 3, value: "1000" },
    { id: 4, value: "500" },
  ]);
  const [nextId, setNextId] = useState(5);
  const [result, setResult] = useState<ChipDistributionResult | null>(null);

  function calculate() {
    setResult(
      calculateChipDistributionFromInputs(rows.map((row) => row.value)),
    );
  }

  return (
    <details className="chip-calculator-disclosure">
      <summary>
        <span>
          <strong>チップ構成を計算</strong>
          <small>会場の額面が違うときだけ</small>
        </span>
        <span aria-hidden="true">›</span>
      </summary>
      <div className="chip-calculator-body">
        <p>使えるチップの額面だけを入力すると、100BBの1人分を提案します。</p>
        <div className="chip-denomination-list">
          {rows.map((row, index) => (
            <label className="chip-denomination-row" key={row.id}>
              <span>額面 {index + 1}</span>
              <input
                aria-label={`チップ額面${index + 1}`}
                inputMode="numeric"
                min={1}
                onChange={(event) => {
                  const value = event.target.value;
                  setRows((current) =>
                    current.map((item) =>
                      item.id === row.id ? { ...item, value } : item,
                    ),
                  );
                  setResult(null);
                }}
                type="number"
                value={row.value}
              />
              <button
                aria-label={`額面${index + 1}を削除`}
                className="chip-denomination-remove"
                onClick={() => {
                  setRows((current) =>
                    current.filter((item) => item.id !== row.id),
                  );
                  setResult(null);
                }}
                type="button"
              >
                ×
              </button>
            </label>
          ))}
        </div>
        <button
          className="chip-denomination-add"
          onClick={() => {
            setRows((current) => [...current, { id: nextId, value: "" }]);
            setNextId((value) => value + 1);
            setResult(null);
          }}
          type="button"
        >
          ＋ 額面を追加
        </button>
        <button
          className="button button-secondary"
          onClick={calculate}
          type="button"
        >
          構成を計算
        </button>

        {result?.ok ? (
          <ChipDistributionResultCard
            onApply={() => onApply(result.recommendation)}
            recommendation={result.recommendation}
          />
        ) : result ? (
          <p className="error-notice" role="alert">
            {result.error}
          </p>
        ) : null}
      </div>
    </details>
  );
}

function ChipDistributionResultCard({
  onApply,
  recommendation,
}: {
  onApply: () => void;
  recommendation: ChipDistributionRecommendation;
}) {
  return (
    <section
      className="chip-recommendation-card"
      aria-label="おすすめのチップ構成"
    >
      <header>
        <span>おすすめ</span>
        <strong>
          {recommendation.initialChips.toLocaleString("ja-JP")}チップ / 100BB
        </strong>
      </header>
      <div className="chip-recommendation-blinds">
        <small>BLINDS</small>
        <strong>
          {recommendation.smallBlindChips.toLocaleString("ja-JP")} /{" "}
          {recommendation.bigBlindChips.toLocaleString("ja-JP")} /{" "}
          {recommendation.bigBlindAnteChips.toLocaleString("ja-JP")}
        </strong>
      </div>
      <div>
        <small>1人分</small>
        <ul className="chip-allocation-list">
          {recommendation.allocations.map((allocation) => (
            <li key={allocation.denomination}>
              <span>{allocation.denomination.toLocaleString("ja-JP")}</span>
              <strong>× {allocation.count}</strong>
            </li>
          ))}
        </ul>
      </div>
      <p className="chip-recommendation-total">
        合計 <strong>{recommendation.totalChipCount}枚</strong> /{" "}
        {recommendation.initialChips.toLocaleString("ja-JP")}チップ
      </p>
      {recommendation.unusedDenominations.length > 0 ? (
        <p className="chip-recommendation-unused">
          未使用{" "}
          {recommendation.unusedDenominations
            .map((value) => value.toLocaleString("ja-JP"))
            .join(" / ")}
        </p>
      ) : null}
      <p>{recommendation.explanation}</p>
      <button className="button button-primary" onClick={onApply} type="button">
        この構成をゲーム設定へ反映
      </button>
      <small>反映後、開催の作成またはゲーム設定の保存で確定します。</small>
    </section>
  );
}

function BlindInput({
  error,
  label,
  min = 1,
  name,
  onChange,
  value,
}: {
  error?: string;
  label: string;
  min?: number;
  name: keyof GameConfigurationValues;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="field blind-input">
      <span className="field-label">{label}</span>
      <input
        aria-invalid={error ? true : undefined}
        inputMode="numeric"
        min={min}
        name={name}
        onChange={(event) => onChange(event.target.value)}
        required
        type="number"
        value={value}
      />
      {error ? <span className="field-error">{error}</span> : null}
    </label>
  );
}

function formatInputChip(value: string): string {
  if (!value.trim()) return "—";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? formatChipValue(parsed) : "—";
}
