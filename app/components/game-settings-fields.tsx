import { useEffect, useMemo, useState } from "react";
import {
  GAME_TITLE_MAX_LENGTH,
  GAME_TITLE_RECOMMENDED_LENGTH,
} from "@domain/game/game-title";
import { calculateCostShares } from "@domain/cost-sharing/calculate-cost-shares";
import { MINIMUM_PODIUM_PARTICIPANT_COUNT } from "@domain/cost-sharing/calculate-podium-cost-shares";
import { formatOrdinal } from "@domain/ranking/format-ordinal";
import {
  recommendTopCosts,
  recommendTopCostsForAttendance,
  type RecommendationMode,
} from "@domain/cost-sharing/recommend-top-costs";
import {
  hasSameSettlementPreviewValues,
  parseSettlementPreviewDraft,
  type SettlementPreviewDraft,
} from "~/utils/settlement-preview-draft";

export interface GameSettingsValues {
  title: string;
  playedAt: string;
  initialChips: string;
  venueCost: string;
  firstPlaceCost: string;
  secondPlaceCost: string;
  thirdPlaceCost: string;
  previewParticipantCount: string;
  costShares: string[];
  sevenDeuceRuleEnabled: boolean;
  bombPotRuleEnabled: boolean;
}

type AdjustmentMode = "top-three" | "individual";

type SettingsErrors = Partial<Record<keyof GameSettingsValues, string>>;

interface GameSettingsFieldsProps {
  actualParticipantCount?: number;
  errors: SettingsErrors;
  onValidityChange?: (valid: boolean) => void;
  onParticipantCountChange?: (value: string) => void;
  settlementDraftBaseValues?: GameSettingsValues;
  settlementDraftStorageKey?: string;
  showCoreSettings?: boolean;
  values: GameSettingsValues;
}

export function GameSettingsFields({
  actualParticipantCount = 0,
  errors,
  onValidityChange,
  onParticipantCountChange,
  settlementDraftBaseValues,
  settlementDraftStorageKey,
  showCoreSettings = true,
  values,
}: GameSettingsFieldsProps) {
  const [venueCost, setVenueCost] = useState(values.venueCost);
  const [participantCountInput, setParticipantCountInput] = useState(
    String(Math.max(4, Number(values.previewParticipantCount) || 4)),
  );
  const [recommendationMode, setRecommendationMode] =
    useState<RecommendationMode>("standard");
  const [shareValues, setShareValues] = useState(() =>
    buildInitialShares(values),
  );
  const [adjustmentMode, setAdjustmentMode] =
    useState<AdjustmentMode>("top-three");
  const [editingRank, setEditingRank] = useState<number | null>(null);
  const [recommendationNotice, setRecommendationNotice] = useState<
    string | null
  >(null);
  const [draftReady, setDraftReady] = useState(!settlementDraftStorageKey);
  const [draftSaved, setDraftSaved] = useState(false);
  const [sevenDeuceRuleEnabled, setSevenDeuceRuleEnabled] = useState(
    values.sevenDeuceRuleEnabled,
  );
  const [bombPotRuleEnabled, setBombPotRuleEnabled] = useState(
    values.bombPotRuleEnabled,
  );

  useEffect(() => {
    setSevenDeuceRuleEnabled(values.sevenDeuceRuleEnabled);
    setBombPotRuleEnabled(values.bombPotRuleEnabled);
  }, [values.bombPotRuleEnabled, values.sevenDeuceRuleEnabled]);

  const analysis = useMemo(
    () => analyzeSettlement(venueCost, participantCountInput, shareValues),
    [participantCountInput, shareValues, venueCost],
  );

  useEffect(() => {
    onValidityChange?.(analysis.isValid);
  }, [analysis.isValid, onValidityChange]);

  useEffect(() => {
    if (!settlementDraftStorageKey) {
      setDraftReady(true);
      setDraftSaved(false);
      return;
    }

    setDraftReady(false);
    try {
      const raw = window.localStorage.getItem(settlementDraftStorageKey);
      const draft = parseSettlementPreviewDraft(raw);
      if (!draft) {
        if (raw) window.localStorage.removeItem(settlementDraftStorageKey);
        setDraftSaved(false);
        return;
      }
      setVenueCost(draft.venueCost);
      setParticipantCountInput(draft.participantCount);
      onParticipantCountChange?.(draft.participantCount);
      setShareValues([...draft.shareValues]);
      setRecommendationMode(draft.recommendationMode);
      setAdjustmentMode(draft.adjustmentMode);
      setEditingRank(null);
      setRecommendationNotice(null);
      setDraftSaved(true);
    } catch {
      setDraftSaved(false);
    } finally {
      setDraftReady(true);
    }
  }, [settlementDraftStorageKey]);

  useEffect(() => {
    if (!settlementDraftStorageKey || !draftReady) return;

    const draft: SettlementPreviewDraft = {
      version: 1,
      venueCost,
      participantCount: participantCountInput,
      shareValues: [...shareValues],
      recommendationMode,
      adjustmentMode,
    };
    const baseValues = settlementDraftBaseValues ?? values;
    const baseline: SettlementPreviewDraft = {
      version: 1,
      venueCost: baseValues.venueCost,
      participantCount: normalizeParticipantCount(baseValues.previewParticipantCount),
      shareValues: buildInitialShares(baseValues),
      recommendationMode: "standard",
      adjustmentMode: "top-three",
    };

    try {
      if (hasSameSettlementPreviewValues(draft, baseline)) {
        window.localStorage.removeItem(settlementDraftStorageKey);
        setDraftSaved(false);
        return;
      }
      window.localStorage.setItem(settlementDraftStorageKey, JSON.stringify(draft));
      setDraftSaved(true);
    } catch {
      setDraftSaved(false);
    }
  }, [
    adjustmentMode,
    draftReady,
    participantCountInput,
    recommendationMode,
    settlementDraftBaseValues,
    settlementDraftStorageKey,
    shareValues,
    values,
    venueCost,
  ]);

  const recommendationAvailable = useMemo(() => {
    try {
      recommendTopCosts(
        parsePreviewInteger(venueCost),
        parseParticipantCount(participantCountInput),
      );
      return true;
    } catch {
      return false;
    }
  }, [participantCountInput, venueCost]);

  const podiumRecommendationAvailable = useMemo(() => {
    try {
      recommendTopCostsForAttendance(
        parsePreviewInteger(venueCost),
        parseParticipantCount(participantCountInput),
        actualParticipantCount,
        "podium",
      );
      return true;
    } catch {
      return false;
    }
  }, [actualParticipantCount, participantCountInput, venueCost]);

  function replaceWithRecommendation(
    nextVenueCost: string,
    nextParticipantCount: string,
    mode: RecommendationMode,
    showNotice: boolean,
  ) {
    let adjusted;
    let effectiveMode = mode;
    try {
      const intendedParticipantCount = parseParticipantCount(
        nextParticipantCount,
      );
      if (
        mode === "podium" &&
        Math.max(intendedParticipantCount, actualParticipantCount) <
          MINIMUM_PODIUM_PARTICIPANT_COUNT
      ) {
        effectiveMode = "standard";
      }
      adjusted = recommendTopCostsForAttendance(
        parsePreviewInteger(nextVenueCost),
        intendedParticipantCount,
        actualParticipantCount,
        effectiveMode,
      );
    } catch {
      return;
    }
    const adjustedParticipantCount = String(adjusted.participantCount);
    setParticipantCountInput(adjustedParticipantCount);
    onParticipantCountChange?.(adjustedParticipantCount);
    setShareValues(adjusted.shares.map(String));
    setEditingRank(null);
    setAdjustmentMode(
      effectiveMode === "standard" || effectiveMode === "gentle"
        ? "top-three"
        : "individual",
    );
    setRecommendationMode(effectiveMode);
    setRecommendationNotice(
      mode === "podium" && effectiveMode === "standard"
        ? "表彰台ボーナスは6人以上のため、標準傾斜に切り替えました。"
        : showNotice
        ? adjusted.adjustedToAttendance
          ? `参加状況${actualParticipantCount}人に合わせて${recommendationLabel(effectiveMode)}を反映しました。`
          : `${adjusted.participantCount}人想定の${recommendationLabel(effectiveMode)}を反映しました。`
        : null,
    );
  }

  function applyRecommendation(mode: RecommendationMode) {
    replaceWithRecommendation(
      venueCost,
      participantCountInput,
      mode,
      true,
    );
  }

  function applyTopThreeDistribution() {
    try {
      const result = calculateCostShares({
        venueCost: parsePreviewInteger(venueCost),
        participantCount: parseParticipantCount(participantCountInput),
        firstPlaceCost: parsePreviewInteger(shareValues[0] ?? ""),
        secondPlaceCost: parsePreviewInteger(shareValues[1] ?? ""),
        thirdPlaceCost: parsePreviewInteger(shareValues[2] ?? ""),
      });
      setShareValues(result.shares.map(String));
      setEditingRank(null);
      setAdjustmentMode("top-three");
      setRecommendationNotice(
        "現在の1〜3位を基準に、4位以下を再配分しました。",
      );
    } catch {
      setRecommendationNotice(
        "1〜3位を100円単位かつ順位順にすると自動配分できます。",
      );
    }
  }

  function updateShare(index: number, value: string) {
    setRecommendationNotice(null);
    setShareValues((current) => {
      const next = current.map((share, shareIndex) =>
        shareIndex === index ? value : share,
      );
      if (adjustmentMode !== "top-three" || index >= 3) {
        return next;
      }
      try {
        return calculateCostShares({
          venueCost: parsePreviewInteger(venueCost),
          participantCount: parseParticipantCount(participantCountInput),
          firstPlaceCost: parsePreviewInteger(next[0] ?? ""),
          secondPlaceCost: parsePreviewInteger(next[1] ?? ""),
          thirdPlaceCost: parsePreviewInteger(next[2] ?? ""),
        }).shares.map(String);
      } catch {
        return next;
      }
    });
  }

  function resetSettlementDraft() {
    const baseValues = settlementDraftBaseValues ?? values;
    const participantCount = normalizeParticipantCount(
      baseValues.previewParticipantCount,
    );
    setVenueCost(baseValues.venueCost);
    setParticipantCountInput(participantCount);
    onParticipantCountChange?.(participantCount);
    setShareValues(buildInitialShares(baseValues));
    setRecommendationMode("standard");
    setAdjustmentMode("top-three");
    setEditingRank(null);
    setRecommendationNotice(null);
    if (settlementDraftStorageKey) {
      try {
        window.localStorage.removeItem(settlementDraftStorageKey);
      } catch {
        // The in-memory reset still succeeds even when browser storage is blocked.
      }
    }
    setDraftSaved(false);
  }

  return (
    <>
      {showCoreSettings ? (
        <>
          <fieldset className="form-section form-section-primary">
            <legend>
              <span>01</span>
              開催情報
            </legend>
            <Field
              defaultValue={values.title}
              error={errors.title}
              label={`開催名（最大${GAME_TITLE_RECOMMENDED_LENGTH}文字）`}
              maxLength={GAME_TITLE_MAX_LENGTH}
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

          <fieldset className="form-section form-section-stack">
            <legend>
              <span>02</span>
              ゲーム設定
            </legend>
            <Field
              defaultValue={values.initialChips}
              error={errors.initialChips}
              inputMode="numeric"
              label="初期チップ（100BB）"
              min={1}
              name="initialChips"
              required
              type="number"
            />
            <p className="field-hint">
              リバイ時も初期チップと同じチップを追加します。
            </p>
          </fieldset>

          <fieldset className="form-section local-rule-create-section">
            <legend>
              <span>03</span>
              ローカルルール
            </legend>
            <details className="local-rules-disclosure">
              <summary className="local-rules-disclosure-summary">
                <span className="local-rules-summary-title">設定を確認・変更</span>
                <span className="local-rules-summary-status">
                  72o {sevenDeuceRuleEnabled ? "ON" : "OFF"} ・ ボムポット {bombPotRuleEnabled ? "ON" : "OFF"}
                </span>
                <span aria-hidden="true" className="local-rules-summary-chevron">›</span>
              </summary>
              <div className="local-rules-disclosure-body">
                <label className="local-rule-toggle-card">
                  <input
                    checked={sevenDeuceRuleEnabled}
                    name="sevenDeuceRuleEnabled"
                    onChange={(event) =>
                      setSevenDeuceRuleEnabled(event.target.checked)
                    }
                    type="checkbox"
                    value="yes"
                  />
                  <span className="local-rule-toggle-copy">
                    <strong>72oボーナス</strong>
                    <small>
                      7と2のオフスートでポットを獲得したら、ほかの参加者全員から2.5BBずつ受け取ります。
                    </small>
                  </span>
                  <span aria-hidden="true" className="local-rule-switch" />
                </label>
                <label className="local-rule-toggle-card">
                  <input
                    checked={bombPotRuleEnabled}
                    name="bombPotRuleEnabled"
                    onChange={(event) => setBombPotRuleEnabled(event.target.checked)}
                    type="checkbox"
                    value="yes"
                  />
                  <span className="local-rule-toggle-copy">
                    <strong>ボムポット</strong>
                    <small>
                      決められたタイミングで全員が2.5BBを強制ベットし、プリフロップを飛ばしてフロップからプレイします。
                    </small>
                  </span>
                  <span aria-hidden="true" className="local-rule-switch" />
                </label>
              </div>
            </details>
          </fieldset>
        </>
      ) : null}

      <fieldset className="form-section form-section-settlement">
        <legend>
          <span>{showCoreSettings ? "04" : "03"}</span>
          精算設定
        </legend>
        <Field
          containerClassName="venue-cost-field"
          error={errors.venueCost}
          inputMode="numeric"
          label="会費"
          name="venueCost"
          onChange={(event) => {
            const nextVenueCost = event.target.value;
            setVenueCost(nextVenueCost);
            setRecommendationNotice(null);
            replaceWithRecommendation(
              nextVenueCost,
              participantCountInput,
              recommendationMode,
              false,
            );
          }}
          placeholder="12000"
          required
          suffix="円"
          type="number"
          value={venueCost}
        />
        <p className="field-hint">
          精算総額は100円単位で切り上げます。
        </p>

        <section className="cost-preview" aria-live="polite">
          <div className="cost-preview-heading">
            <div>
              <h2>精算プレビュー</h2>
              {settlementDraftStorageKey && draftSaved ? (
                <div className="settlement-draft-indicator">
                  <span role="status">● 下書き保存済み</span>
                  <button
                    className="text-button"
                    onClick={resetSettlementDraft}
                    type="button"
                  >
                    元の設定に戻す
                  </button>
                </div>
              ) : null}
            </div>
            <Field
              containerClassName="preview-count-field"
              error={errors.previewParticipantCount}
              inputMode="numeric"
              label="人数"
              min={4}
              name="previewParticipantCount"
              onChange={(event) => {
                const nextParticipantCount = event.target.value;
                setRecommendationNotice(null);
                setParticipantCountInput(nextParticipantCount);
                onParticipantCountChange?.(nextParticipantCount);
                replaceWithRecommendation(
                  venueCost,
                  nextParticipantCount,
                  recommendationMode,
                  false,
                );
              }}
              required
              suffix="人"
              type="number"
              value={participantCountInput}
            />
          </div>

          {recommendationAvailable ? (
            <div className="recommendation-card">
              <div>
                <p className="recommendation-title">
                  おすすめ配分をすぐ反映
                </p>
                <p>
                  表彰台は1〜3位を優遇、標準は順位差をしっかり、ゆる傾斜は差を小さく、割り勘はほぼ均等です。
                </p>
                {recommendationNotice ? (
                  <small className="recommendation-notice">
                    {recommendationNotice}
                  </small>
                ) : !podiumRecommendationAvailable ? (
                  <small>表彰台ボーナスは6人以上で利用できます。</small>
                ) : null}
              </div>
              <div className="recommendation-actions">
                <button
                  aria-pressed={recommendationMode === "podium"}
                  className={`button button-small button-secondary${recommendationMode === "podium" ? " is-active" : ""}`}
                  disabled={!podiumRecommendationAvailable}
                  onClick={() => applyRecommendation("podium")}
                  title={
                    podiumRecommendationAvailable
                      ? undefined
                      : "表彰台ボーナスは6人以上で利用できます"
                  }
                  type="button"
                >
                  表彰台を反映
                </button>
                <button
                  aria-pressed={recommendationMode === "standard"}
                  className={`button button-small button-secondary${recommendationMode === "standard" ? " is-active" : ""}`}
                  onClick={() => applyRecommendation("standard")}
                  type="button"
                >
                  標準を反映
                </button>
                <button
                  aria-pressed={recommendationMode === "gentle"}
                  className={`button button-small button-secondary${recommendationMode === "gentle" ? " is-active" : ""}`}
                  onClick={() => applyRecommendation("gentle")}
                  type="button"
                >
                  ゆる傾斜を反映
                </button>
                <button
                  aria-pressed={recommendationMode === "simple"}
                  className={`button button-small button-secondary${recommendationMode === "simple" ? " is-active" : ""}`}
                  onClick={() => applyRecommendation("simple")}
                  type="button"
                >
                  割り勘を反映
                </button>
              </div>
            </div>
          ) : null}

          <div
            aria-label="精算額の調整方法"
            className="settlement-adjustment-control"
            role="group"
          >
            <span>調整方法</span>
            <div>
              <button
                aria-pressed={adjustmentMode === "top-three"}
                className={adjustmentMode === "top-three" ? "is-active" : ""}
                onClick={applyTopThreeDistribution}
                type="button"
              >
                上位3位から配分
              </button>
              <button
                aria-pressed={adjustmentMode === "individual"}
                className={adjustmentMode === "individual" ? "is-active" : ""}
                onClick={() => setAdjustmentMode("individual")}
                type="button"
              >
                全順位を個別調整
              </button>
            </div>
          </div>
          <p className="settlement-edit-hint">
            {adjustmentMode === "top-three"
              ? "1〜3位を変えると、4位以下を自動で再配分します。"
              : "変更した順位だけを調整します。"}
          </p>
          <div className="share-grid">
            {shareValues.map((share, index) => (
              <div
                className={`share-item${analysis.invalidRankIndex === index ? " is-invalid" : ""}`}
                key={index}
              >
                <span>{formatOrdinal(index + 1)}</span>
                {editingRank === index ? (
                  <span className="share-amount-input-wrap">
                    <input
                      aria-label={`${index + 1}位の負担額`}
                      autoFocus
                      className="share-amount-input"
                      inputMode="numeric"
                      min={0}
                      onBlur={() => setEditingRank(null)}
                      onChange={(event) =>
                        updateShare(index, event.target.value)
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          event.currentTarget.blur();
                        }
                      }}
                      pattern="[0-9]*"
                      type="text"
                      value={share}
                    />
                    <span>円</span>
                  </span>
                ) : (
                  <button
                    aria-label={`${index + 1}位の負担額 ${formatShareValue(share)}。タップして編集`}
                    className="share-amount-button"
                    onClick={() => {
                      if (index >= 3) {
                        setAdjustmentMode("individual");
                      }
                      setEditingRank(index);
                    }}
                    type="button"
                  >
                    <strong>{formatShareValue(share)}</strong>
                  </button>
                )}
                <input name="costShare" type="hidden" value={share} />
              </div>
            ))}
          </div>
          <input
            name="firstPlaceCost"
            type="hidden"
            value={shareValues[0] ?? ""}
          />
          <input
            name="secondPlaceCost"
            type="hidden"
            value={shareValues[1] ?? ""}
          />
          <input
            name="thirdPlaceCost"
            type="hidden"
            value={shareValues[2] ?? ""}
          />
          <div className="preview-totals">
            <span>
              精算総額{" "}
              <strong>{formatOptionalYen(analysis.settlementTotal)}</strong>
            </span>
            <span>
              負担額合計{" "}
              <strong>{formatOptionalYen(analysis.allocatedTotal)}</strong>
            </span>
          </div>
          <p
            className={`settlement-validation ${analysis.isValid ? "is-valid" : "is-error"}`}
            role={analysis.isValid ? "status" : "alert"}
          >
            {errors.costShares ?? analysis.message}
          </p>
        </section>
      </fieldset>
    </>
  );
}

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  containerClassName?: string;
  error?: string;
  label: React.ReactNode;
  name: string;
  suffix?: string;
}

export function Field({
  containerClassName,
  error,
  label,
  name,
  suffix,
  ...inputProps
}: FieldProps) {
  const errorId = `${name}-error`;
  return (
    <label
      className={`field${containerClassName ? ` ${containerClassName}` : ""}`}
      htmlFor={name}
    >
      <span className="field-label">{label}</span>
      <span className="input-wrap">
        <input
          {...inputProps}
          aria-describedby={error ? errorId : undefined}
          aria-invalid={Boolean(error)}
          id={name}
          min={
            inputProps.min ??
            (inputProps.type === "number" ? 0 : undefined)
          }
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

function parseParticipantCount(value: string): number {
  const parsed = parsePreviewInteger(value);
  if (parsed < 4) throw new RangeError("participant count is too small");
  return parsed;
}

function normalizeParticipantCount(value: string): string {
  try {
    return String(parseParticipantCount(value));
  } catch {
    return "4";
  }
}

function buildInitialShares(values: GameSettingsValues): string[] {
  let participantCount: number;
  try {
    participantCount = parseParticipantCount(values.previewParticipantCount);
  } catch {
    participantCount = 4;
  }
  if (values.costShares.length === participantCount) {
    return [...values.costShares];
  }
  try {
    return calculateCostShares({
      venueCost: parsePreviewInteger(values.venueCost),
      participantCount,
      firstPlaceCost: parsePreviewInteger(values.firstPlaceCost),
      secondPlaceCost: parsePreviewInteger(values.secondPlaceCost),
      thirdPlaceCost: parsePreviewInteger(values.thirdPlaceCost),
    }).shares.map(String);
  } catch {
    try {
      return recommendTopCosts(
        parsePreviewInteger(values.venueCost),
        participantCount,
      ).shares.map(String);
    } catch {
      return Array.from({ length: participantCount }, () => "0");
    }
  }
}

interface SettlementAnalysis {
  allocatedTotal: number | null;
  invalidRankIndex: number | null;
  isValid: boolean;
  message: string;
  settlementTotal: number | null;
}

function analyzeSettlement(
  venueCostValue: string,
  participantCountValue: string,
  shares: string[],
): SettlementAnalysis {
  let venueCost: number;
  let participantCount: number;
  try {
    venueCost = parsePreviewInteger(venueCostValue);
  } catch {
    return invalidAnalysis("会費を0以上の整数で入力してください。");
  }
  const settlementTotal = Math.ceil(venueCost / 100) * 100;
  try {
    participantCount = parseParticipantCount(participantCountValue);
  } catch {
    return invalidAnalysis(
      "人数は4人以上で入力してください。",
      settlementTotal,
    );
  }
  if (shares.length !== participantCount) {
    return invalidAnalysis(
      `負担額は${participantCount}人分必要です。人数を確認してください。`,
      settlementTotal,
    );
  }
  const parsedShares: number[] = [];
  for (const [index, share] of shares.entries()) {
    try {
      parsedShares.push(parsePreviewInteger(share));
    } catch {
      return invalidAnalysis(
        `${index + 1}位の負担額を0以上の整数で入力してください。`,
        settlementTotal,
        null,
        index,
      );
    }
  }
  const allocatedTotal = parsedShares.reduce(
    (total, share) => total + share,
    0,
  );
  const unroundedIndex = parsedShares.findIndex((share) => share % 100 !== 0);
  if (unroundedIndex >= 0) {
    return invalidAnalysis(
      `${unroundedIndex + 1}位の負担額を100円単位にしてください。`,
      settlementTotal,
      allocatedTotal,
      unroundedIndex,
    );
  }
  const reversedIndex = parsedShares.findIndex(
    (share, index) => index > 0 && share < parsedShares[index - 1]!,
  );
  if (reversedIndex >= 0) {
    return invalidAnalysis(
      `${reversedIndex + 1}位は${reversedIndex}位以上の負担額にしてください。`,
      settlementTotal,
      allocatedTotal,
      reversedIndex,
    );
  }
  const difference = settlementTotal - allocatedTotal;
  if (difference > 0) {
    return invalidAnalysis(
      `あと${formatNumber(difference)}円割り振ってください。`,
      settlementTotal,
      allocatedTotal,
    );
  }
  if (difference < 0) {
    return invalidAnalysis(
      `${formatNumber(Math.abs(difference))}円多いです。`,
      settlementTotal,
      allocatedTotal,
    );
  }
  return {
    allocatedTotal,
    invalidRankIndex: null,
    isValid: true,
    message: `${formatYen(settlementTotal)} ✓ 配分が一致しています。`,
    settlementTotal,
  };
}

function invalidAnalysis(
  message: string,
  settlementTotal: number | null = null,
  allocatedTotal: number | null = null,
  invalidRankIndex: number | null = null,
): SettlementAnalysis {
  return {
    allocatedTotal,
    invalidRankIndex,
    isValid: false,
    message,
    settlementTotal,
  };
}

function formatYen(value: number): string {
  return `${formatNumber(value)}円`;
}

function formatOptionalYen(value: number | null): string {
  return value === null ? "—" : formatYen(value);
}

function formatShareValue(value: string): string {
  try {
    return formatYen(parsePreviewInteger(value));
  } catch {
    return "未入力";
  }
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ja-JP").format(value);
}

function recommendationLabel(mode: RecommendationMode): string {
  if (mode === "podium") return "表彰台ボーナス";
  if (mode === "gentle") return "ゆる傾斜";
  if (mode === "simple") return "シンプル割り勘";
  return "標準傾斜";
}
