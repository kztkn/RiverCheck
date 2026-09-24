import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  GameSettingsFields,
  type GameSettingsValues,
} from "./game-settings-fields";

const baseValues: GameSettingsValues = {
  title: "テスト開催",
  playedAt: "2026-08-29",
  initialChips: "20000",
  smallBlindChips: "100",
  bigBlindChips: "200",
  bigBlindAnteChips: "200",
  venueCost: "12000",
  firstPlaceCost: "0",
  secondPlaceCost: "500",
  thirdPlaceCost: "1000",
  previewParticipantCount: "8",
  costShares: ["0", "500", "1000", "2100", "2100", "2100", "2100", "2100"],
  bbRate: "0",
  sevenDeuceRuleEnabled: true,
  bombPotRuleEnabled: true,
};

describe("GameSettingsFields local rules", () => {
  it("50BBと100BBのショートカットはBBを変えず初期チップを調整する", () => {
    const markup = renderToStaticMarkup(
      createElement(GameSettingsFields, {
        errors: {},
        values: { ...baseValues, initialChips: "10000" },
      }),
    );

    expect(markup).toContain('aria-label="開始スタックのショートカット"');
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain("50BB");
    expect(markup).toContain('aria-label="その他の開始スタックBB"');
    expect(markup).toContain("BBのチップ量から初期チップを自動計算します。");
    expect(markup).toContain('type="hidden" name="initialChips" value="10000"');
    expect(markup).toContain("リバイも開始時と同じチップ枚数・BBです。");
  });

  it("SB・BB入力、開始BB、計算結果、チップ計算機の順に表示する", () => {
    const standardMarkup = renderToStaticMarkup(
      createElement(GameSettingsFields, { errors: {}, values: baseValues }),
    );
    expect(standardMarkup).toContain("今回のゲーム設定");
    expect(standardMarkup).toContain("<small>SB</small><strong>100</strong>");
    expect(standardMarkup).toContain("<small>BB</small><strong>200</strong>");
    expect(standardMarkup).toContain("<small>BBA</small><strong>200</strong>");
    expect(standardMarkup).toContain("ブラインド");
    expect(standardMarkup).toContain('name="smallBlindChips" value="100"');
    expect(standardMarkup).toContain('name="bigBlindChips" value="200"');
    expect(standardMarkup).toContain(
      'type="hidden" name="bigBlindAnteChips" value="200"',
    );
    expect(standardMarkup).toContain("BBAはBBと同額（200）で自動設定します。");
    expect(standardMarkup).toContain("20,000チップ / 100BB");

    const blindIndex = standardMarkup.indexOf("ブラインド");
    const stackIndex = standardMarkup.indexOf("開始スタック");
    const previewIndex = standardMarkup.indexOf("今回のゲーム設定");
    const calculatorIndex = standardMarkup.indexOf("チップ構成を計算");
    expect(blindIndex).toBeLessThan(stackIndex);
    expect(stackIndex).toBeLessThan(previewIndex);
    expect(previewIndex).toBeLessThan(calculatorIndex);

    const compactMarkup = renderToStaticMarkup(
      createElement(GameSettingsFields, {
        errors: {},
        values: {
          ...baseValues,
          initialChips: "10000",
        },
      }),
    );
    expect(compactMarkup).toContain("<small>SB</small><strong>100</strong>");
    expect(compactMarkup).toContain("<small>BB</small><strong>200</strong>");
    expect(compactMarkup).toContain("<small>BBA</small><strong>200</strong>");
    expect(compactMarkup).toContain("10,000チップ / 50BB");
    expect(compactMarkup).toContain("1BB = 200チップ");
  });

  it("チップ構成計算の初期額面を5,000・1,000・500・100にする", () => {
    const markup = renderToStaticMarkup(
      createElement(GameSettingsFields, { errors: {}, values: baseValues }),
    );

    expect(markup).toContain('aria-label="チップ額面1"');
    expect(markup).toContain(
      'aria-label="チップ額面1" inputMode="numeric" min="1" type="number" value="5000"',
    );
    expect(markup).toContain(
      'aria-label="チップ額面2" inputMode="numeric" min="1" type="number" value="1000"',
    );
    expect(markup).toContain(
      'aria-label="チップ額面3" inputMode="numeric" min="1" type="number" value="500"',
    );
    expect(markup).toContain(
      'aria-label="チップ額面4" inputMode="numeric" min="1" type="number" value="100"',
    );
  });

  it("会費はスマホでも見出しを入力欄の上へ置く構造にする", () => {
    const markup = renderToStaticMarkup(
      createElement(GameSettingsFields, { errors: {}, values: baseValues }),
    );

    expect(markup).toContain(
      '<label class="field venue-cost-field" for="venueCost"><span class="field-label">会費</span><span class="input-wrap">',
    );
  });

  it("ローカルルールを初期状態では閉じ、現在のON/OFFを要約表示する", () => {
    const markup = renderToStaticMarkup(
      createElement(GameSettingsFields, { errors: {}, values: baseValues }),
    );

    expect(markup).toContain("<details");
    expect(markup).toContain("72o ON ・ ボムポット ON");
    expect(markup).not.toMatch(/<details[^>]*\sopen(?:=|\s|>)/u);
  });

  it("BBレート0ではゲーム収支を閉じ、現在のレートを要約する", () => {
    const markup = renderToStaticMarkup(
      createElement(GameSettingsFields, { errors: {}, values: baseValues }),
    );

    expect(markup).toContain("<strong>ゲーム収支</strong>");
    expect(markup).toContain("1BB = 0円");
    expect(markup).toContain('aria-label="BBレート"');
    expect(markup).toContain(">0円</button>");
    expect(markup).not.toMatch(/<details[^>]*\sopen(?:=|\s|>)/u);
  });

  it("BBレート有効時は現在値と100円単位調整を表示する", () => {
    const markup = renderToStaticMarkup(
      createElement(GameSettingsFields, {
        errors: {},
        values: { ...baseValues, bbRate: "5" },
      }),
    );

    expect(markup).toContain("1BB = 5円");
    expect(markup).toContain("100円単位で調整します");
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toMatch(/<details[^>]*\sopen(?:=|\s|>)/u);
  });

  it("終了入力が揃えばゲーム・会費・最終精算をプレビューする", () => {
    const markup = renderToStaticMarkup(
      createElement(GameSettingsFields, {
        errors: {},
        settlementParticipants: [
          {
            id: "participant-1",
            groupPlayerId: "player-1",
            displayName: "Alice",
            status: "submitted",
            remainingChips: 40_000,
            totalRebuyCount: 0,
            outstandingRebuyCount: 0,
            settlementRebuyCount: 0,
            deviceLocked: true,
            avatarUpdatedAt: null,
          },
          {
            id: "participant-2",
            groupPlayerId: "player-2",
            displayName: "Bob",
            status: "submitted",
            remainingChips: 0,
            totalRebuyCount: 0,
            outstandingRebuyCount: 0,
            settlementRebuyCount: 0,
            deviceLocked: true,
            avatarUpdatedAt: null,
          },
        ],
        values: {
          ...baseValues,
          venueCost: "3000",
          previewParticipantCount: "2",
          costShares: ["1000", "2000"],
          firstPlaceCost: "1000",
          secondPlaceCost: "2000",
          thirdPlaceCost: "2000",
          bbRate: "5",
        },
      }),
    );

    expect(markup).toContain("最終精算プレビュー");
    expect(markup).toContain("ゲーム +500円 / 会費 -1,000円");
    expect(markup).toContain("支払 500円");
    expect(markup).toContain("支払 2,500円");
  });

  it("OFF設定も閉じた状態の要約へ反映する", () => {
    const markup = renderToStaticMarkup(
      createElement(GameSettingsFields, {
        errors: {},
        values: {
          ...baseValues,
          sevenDeuceRuleEnabled: false,
          bombPotRuleEnabled: false,
        },
      }),
    );

    expect(markup).toContain("72o OFF ・ ボムポット OFF");
  });
});
