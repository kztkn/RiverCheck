import { useState } from "react";
import {
  recommendBlindStructureFromInventory,
  type BlindStructureRecommendation,
  type BlindStructureResult,
  type ChipInventoryItem,
} from "@domain/chip-distribution/recommend-blind-structure";

interface InventoryRow {
  id: number;
  denomination: string;
  count: string;
}

const DEFAULT_ROWS: InventoryRow[] = [
  { id: 1, denomination: "5000", count: "" },
  { id: 2, denomination: "1000", count: "" },
  { id: 3, denomination: "500", count: "" },
  { id: 4, denomination: "100", count: "" },
];

export function ChipBlindTool() {
  const [participantCount, setParticipantCount] = useState("8");
  const [rows, setRows] = useState<InventoryRow[]>(DEFAULT_ROWS);
  const [nextId, setNextId] = useState(5);
  const [result, setResult] = useState<BlindStructureResult | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);

  function clearResult() {
    setInputError(null);
    setResult(null);
  }

  function calculate() {
    const activeRows = rows.filter(
      (row) => row.denomination.trim() || row.count.trim(),
    );
    if (activeRows.length === 0) {
      setResult(null);
      setInputError("持っているチップの額面と枚数を入力してください。");
      return;
    }
    if (
      activeRows.some(
        (row) => !row.denomination.trim() || !row.count.trim(),
      )
    ) {
      setResult(null);
      setInputError("使う行は、額面と枚数を両方入力してください。");
      return;
    }

    const inventory: ChipInventoryItem[] = activeRows.map((row) => ({
      denomination: Number(row.denomination),
      count: Number(row.count),
    }));
    setInputError(null);
    setResult(
      recommendBlindStructureFromInventory(
        inventory,
        Number(participantCount),
      ),
    );
  }

  return (
    <section
      aria-labelledby="chip-blind-tool-title"
      className="chip-blind-tool"
    >
      <header className="chip-blind-tool-heading">
        <div>
          <p className="eyebrow">CHIP LAB</p>
          <h2 id="chip-blind-tool-title">チップ・ブラインド計算</h2>
        </div>
        <span>保存なし</span>
      </header>

      <p className="chip-blind-tool-lead">
        持っているチップの在庫と参加人数から、全員へ同じ構成を配れるSB・BBと100BBの開始スタックを提案します。
      </p>

      <div className="chip-blind-tool-form">
        <label className="chip-blind-participants">
          <span>参加人数</span>
          <span className="input-wrap">
            <input
              aria-label="参加人数"
              inputMode="numeric"
              max={20}
              min={2}
              onChange={(event) => {
                setParticipantCount(event.target.value);
                clearResult();
              }}
              type="number"
              value={participantCount}
            />
            <span className="input-suffix">人</span>
          </span>
        </label>

        <div className="chip-stock-heading">
          <strong>持っているチップ</strong>
          <small>額面と、その額面の総枚数</small>
        </div>

        <div className="chip-stock-list">
          {rows.map((row, index) => (
            <div className="chip-stock-row" key={row.id}>
              <label>
                <span>額面</span>
                <input
                  aria-label={`チップ額面${index + 1}`}
                  inputMode="numeric"
                  min={1}
                  onChange={(event) => {
                    const denomination = event.target.value;
                    setRows((current) =>
                      current.map((item) =>
                        item.id === row.id
                          ? { ...item, denomination }
                          : item,
                      ),
                    );
                    clearResult();
                  }}
                  type="number"
                  value={row.denomination}
                />
              </label>
              <label>
                <span>枚数</span>
                <span className="input-wrap">
                  <input
                    aria-label={`チップ枚数${index + 1}`}
                    inputMode="numeric"
                    min={0}
                    onChange={(event) => {
                      const count = event.target.value;
                      setRows((current) =>
                        current.map((item) =>
                          item.id === row.id ? { ...item, count } : item,
                        ),
                      );
                      clearResult();
                    }}
                    placeholder="0"
                    type="number"
                    value={row.count}
                  />
                  <span className="input-suffix">枚</span>
                </span>
              </label>
              <button
                aria-label={`額面${index + 1}を削除`}
                className="chip-stock-remove"
                onClick={() => {
                  setRows((current) =>
                    current.filter((item) => item.id !== row.id),
                  );
                  clearResult();
                }}
                type="button"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <button
          className="chip-stock-add"
          onClick={() => {
            setRows((current) => [
              ...current,
              { id: nextId, denomination: "", count: "" },
            ]);
            setNextId((value) => value + 1);
            clearResult();
          }}
          type="button"
        >
          ＋ 額面を追加
        </button>

        <button
          className="button button-primary chip-blind-calculate"
          onClick={calculate}
          type="button"
        >
          おすすめを計算
        </button>
      </div>

      <p className="chip-blind-tool-note">
        入力内容や計算結果は開催データへ反映せず、ブラウザにも保存しません。
      </p>

      {inputError ? (
        <p className="error-notice" role="alert">
          {inputError}
        </p>
      ) : null}
      {result?.ok ? (
        <BlindRecommendationCard recommendation={result.recommendation} />
      ) : result ? (
        <p className="error-notice" role="alert">
          {result.error}
        </p>
      ) : null}
    </section>
  );
}

function BlindRecommendationCard({
  recommendation,
}: {
  recommendation: BlindStructureRecommendation;
}) {
  return (
    <section
      aria-label="おすすめのブラインドとチップ構成"
      className="blind-tool-result"
    >
      <header>
        <div>
          <small>RECOMMENDED BLINDS</small>
          <strong>
            SB {formatNumber(recommendation.smallBlindChips)} / BB{" "}
            {formatNumber(recommendation.bigBlindChips)}
          </strong>
        </div>
        <span>100BB</span>
      </header>

      <div className="blind-tool-metrics">
        <span>
          <small>開始スタック</small>
          <strong>{formatNumber(recommendation.initialChips)}</strong>
        </span>
        <span>
          <small>1人あたり</small>
          <strong>{recommendation.totalChipCount}枚</strong>
          <em>{chipCountAssessment(recommendation.totalChipCount)}</em>
        </span>
        <span>
          <small>{recommendation.participantCount}人分</small>
          <strong>{recommendation.totalRequiredChipCount}枚</strong>
        </span>
      </div>

      <div className="blind-tool-section">
        <div className="blind-tool-section-heading">
          <strong>1人分の構成</strong>
          <small>全員に同じセットを配布</small>
        </div>
        <div className="blind-tool-allocation">
          {recommendation.allocations.map((allocation) => (
            <span key={allocation.denomination}>
              <small>{formatNumber(allocation.denomination)}</small>
              <strong>× {allocation.count}</strong>
            </span>
          ))}
        </div>
      </div>

      <div className="blind-tool-section">
        <div className="blind-tool-section-heading">
          <strong>在庫チェック</strong>
          <small>必要枚数 / 在庫 / 残り</small>
        </div>
        <div className="blind-tool-stock-usage">
          {recommendation.inventoryUsage.map((usage) => (
            <div key={usage.denomination}>
              <strong>{formatNumber(usage.denomination)}</strong>
              {usage.requiredCount > 0 ? (
                <span>
                  {usage.requiredCount} / {usage.availableCount} /{" "}
                  <b>{usage.remainingCount}</b>
                </span>
              ) : (
                <span>初期配布では未使用 ・ 在庫 {usage.availableCount}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <p className="blind-tool-bba">
        BBAありで遊ぶ場合は、BBと同額の
        <strong>{formatNumber(recommendation.bigBlindAnteChips)}</strong>
        を目安にできます。
      </p>
      <p className="blind-tool-explanation">{recommendation.explanation}</p>
    </section>
  );
}

export function chipCountAssessment(totalChipCount: number): string {
  if (totalChipCount <= 28) return "扱いやすい枚数";
  if (totalChipCount <= 35) return "やや多め・両替しやすさ優先";
  return "多め・在庫制約を優先";
}

function formatNumber(value: number): string {
  return value.toLocaleString("ja-JP");
}
