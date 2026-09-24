import { useEffect, useMemo, useRef, useState } from "react";
import {
  recommendChipDistribution,
  type ChipDistributionRecommendation,
  type ChipDistributionResult,
} from "@domain/chip-distribution/recommend-chip-distribution";
import {
  calculateInitialChips,
  calculateInitialStackBb,
  formatChipValue,
  INITIAL_STACK_BB_OPTIONS,
  isSupportedInitialStackBb,
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
  const [stackDepthInput, setStackDepthInput] = useState(
    initialStackBb === null ? "" : String(initialStackBb),
  );
  const [applicationNotice, setApplicationNotice] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (initialStackBb !== null) setStackDepthInput(String(initialStackBb));
  }, [initialStackBb]);

  useEffect(() => {
    if (!applicationNotice) return;
    const timeoutId = window.setTimeout(() => setApplicationNotice(null), 6000);
    return () => window.clearTimeout(timeoutId);
  }, [applicationNotice]);

  function update(field: keyof GameConfigurationValues, value: string) {
    setApplicationNotice(null);
    onChange({ ...values, [field]: value });
  }

  function updateBigBlind(value: string) {
    setApplicationNotice(null);
    onChange(
      gameConfigurationWithBigBlind(values, value, Number(stackDepthInput)),
    );
  }

  function applyStackDepth(stackBb: number) {
    try {
      setApplicationNotice(null);
      setStackDepthInput(String(stackBb));
      onChange(gameConfigurationWithStackDepth(values, stackBb));
    } catch {
      // BB入力が一時的に空や不正な間は、直前の保存可能な値を維持する。
    }
  }

  const customStackDepth =
    initialStackBb !== null &&
    !INITIAL_STACK_BB_OPTIONS.some((option) => option === initialStackBb);

  return (
    <>
      <input name="initialChips" type="hidden" value={values.initialChips} />
      <input
        name="bigBlindAnteChips"
        type="hidden"
        value={values.bigBlindAnteChips}
      />

      <section aria-label="ブラインド" className="game-config-block">
        <div className="game-config-block-heading">
          <strong>ブラインド</strong>
          <small>チップ量</small>
        </div>
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
            onChange={updateBigBlind}
            value={values.bigBlindChips}
          />
        </div>
        <p className="field-hint">
          {values.bigBlindAnteChips === "0"
            ? "この既存開催はBBAなしです。BBを変更してもBBAなしを維持します。"
            : `BBAはBBと同額（${formatInputChip(values.bigBlindChips)}）で自動設定します。`}
        </p>
        {errors.bigBlindAnteChips ? (
          <span className="field-error">{errors.bigBlindAnteChips}</span>
        ) : null}
      </section>

      <div
        className="initial-stack-shortcuts"
        aria-label="開始スタックのショートカット"
      >
        <span>開始スタック</span>
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
          <label
            className={`initial-stack-custom${customStackDepth ? " is-active" : ""}`}
          >
            <input
              aria-label="任意の開始スタックBB"
              inputMode="numeric"
              min={1}
              onChange={(event) => {
                const next = event.target.value;
                setStackDepthInput(next);
                if (!next.trim()) return;
                applyStackDepth(Number(next));
              }}
              placeholder="任意"
              type="number"
              value={customStackDepth ? stackDepthInput : ""}
            />
            <span>BB</span>
          </label>
        </div>
        <small>BBのチップ量から初期チップを自動計算します。</small>
      </div>

      <div aria-live="polite" className="blind-structure-preview">
        <div className="blind-structure-heading">
          <span>今回のゲーム設定</span>
          <small>自動計算</small>
        </div>
        {initialStackBb === null ? (
          <p>BBと開始スタックを1以上の整数で設定してください。</p>
        ) : (
          <>
            <strong className="blind-structure-stack">
              {formatInputChip(values.initialChips)}チップ / {initialStackBb}BB
            </strong>
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
            <p>1BB = {formatInputChip(values.bigBlindChips)}チップ</p>
          </>
        )}
        {errors.initialChips ? (
          <span className="field-error">{errors.initialChips}</span>
        ) : null}
        {applicationNotice ? (
          <p className="game-config-applied-notice" role="status">
            {applicationNotice}
          </p>
        ) : null}
      </div>

      <ChipDistributionCalculator
        onApply={(recommendation) => {
          setStackDepthInput(String(recommendation.initialStackBb));
          onChange(gameConfigurationFromRecommendation(recommendation));
          setApplicationNotice(
            "チップ構成を反映しました。開催の作成またはゲーム設定の保存で確定します。",
          );
        }}
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

export function gameConfigurationWithBigBlind(
  values: GameConfigurationValues,
  bigBlindChips: string,
  stackDepthBb?: number,
): GameConfigurationValues {
  const next = {
    ...values,
    bigBlindChips,
    bigBlindAnteChips:
      values.bigBlindAnteChips.trim() === "0" ? "0" : bigBlindChips,
  };
  try {
    const candidateStackDepth = stackDepthBb ?? 0;
    const currentStackDepth = isSupportedInitialStackBb(candidateStackDepth)
      ? candidateStackDepth
      : calculateInitialStackBb(
          Number(values.initialChips),
          Number(values.bigBlindChips),
        );
    return gameConfigurationWithStackDepth(next, currentStackDepth);
  } catch {
    return next;
  }
}

export function gameConfigurationWithStackDepth(
  values: GameConfigurationValues,
  stackDepthBb: number,
): GameConfigurationValues {
  return {
    ...values,
    initialChips: String(
      calculateInitialChips(Number(values.bigBlindChips), stackDepthBb),
    ),
  };
}

export function closeChipCalculator(
  disclosure: { open: boolean } | null,
): void {
  if (disclosure) disclosure.open = false;
}

function ChipDistributionCalculator({
  onApply,
}: {
  onApply: (recommendation: ChipDistributionRecommendation) => void;
}) {
  const [rows, setRows] = useState(() => [
    { id: 1, value: "5000" },
    { id: 2, value: "1000" },
    { id: 3, value: "500" },
    { id: 4, value: "100" },
  ]);
  const [nextId, setNextId] = useState(5);
  const [result, setResult] = useState<ChipDistributionResult | null>(null);
  const disclosureRef = useRef<HTMLDetailsElement>(null);

  function calculate() {
    setResult(
      calculateChipDistributionFromInputs(rows.map((row) => row.value)),
    );
  }

  return (
    <details className="chip-calculator-disclosure" ref={disclosureRef}>
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
            onApply={() => {
              onApply(result.recommendation);
              setResult(null);
              closeChipCalculator(disclosureRef.current);
            }}
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
  name,
  onChange,
  value,
}: {
  error?: string;
  label: string;
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
        min={1}
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
