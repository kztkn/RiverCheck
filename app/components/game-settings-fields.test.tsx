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
  chipDistribution: "",
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
    expect(markup).toContain('aria-label="任意の開始スタックBB"');
    expect(markup).toContain('placeholder="任意"');
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
    expect(standardMarkup).toContain(
      'type="hidden" name="chipDistribution" value=""',
    );
    expect(standardMarkup).toContain('aria-label="BBAの有無"');
    expect(standardMarkup).toContain(
      'aria-pressed="true" type="button">あり</button>',
    );
    expect(standardMarkup).toContain("BBと同額（200）で自動設定します。");
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

  it("BBAなしを選べる状態と確認表示を出す", () => {
    const markup = renderToStaticMarkup(
      createElement(GameSettingsFields, {
        errors: {},
        values: { ...baseValues, bigBlindAnteChips: "0" },
      }),
    );

    expect(markup).toContain('aria-pressed="true" type="button">なし</button>');
    expect(markup).toContain("アンティなしで進行します。");
    expect(markup).toContain("<small>BBA</small><strong>なし</strong>");
    expect(markup).toContain(
      'type="hidden" name="bigBlindAnteChips" value="0"',
    );
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

  it("実費はスマホでも見出しを入力欄の上へ置く構造にする", () => {
    const markup = renderToStaticMarkup(
      createElement(GameSettingsFields, { errors: {}, values: baseValues }),
    );

    expect(markup).toContain(
      '<label class="field venue-cost-field" for="venueCost"><span class="field-label">実費</span><span class="input-wrap">',
    );
  });

  it("ゲーム設定とローカルルールを詳細設定へまとめて初期状態では閉じる", () => {
    const markup = renderToStaticMarkup(
      createElement(GameSettingsFields, { errors: {}, values: baseValues }),
    );

    expect(markup).toContain("<span>02</span>詳細設定");
    expect(markup).toContain("いつもの設定から変えるときだけ開いてください。");
    expect(markup).toContain(
      "<strong>ゲーム設定</strong><small>100BB開始 ・ SB 100 / BB 200 / BBA 200</small>",
    );
    expect(markup).toContain(
      "<strong>ローカルルール</strong><small>72o ON ・ ボムポット ON</small>",
    );
    expect(markup.match(/class="advanced-setting-disclosure"/gu) ?? []).toHaveLength(2);
    expect(markup).not.toMatch(
      /<details class="advanced-setting-disclosure" open=""/u,
    );
  });

  it("ゲーム設定の入力エラーがある場合は詳細設定を自動で開く", () => {
    const markup = renderToStaticMarkup(
      createElement(GameSettingsFields, {
        errors: { bigBlindChips: "BBを確認してください。" },
        values: baseValues,
      }),
    );

    expect(markup).toMatch(
      /<details class="advanced-setting-disclosure" open="">/u,
    );
  });

  it("新規作成では03の当日の負担を開き、開催管理では要約付きで閉じる", () => {
    const creationMarkup = renderToStaticMarkup(
      createElement(GameSettingsFields, { errors: {}, values: baseValues }),
    );
    const adminMarkup = renderToStaticMarkup(
      createElement(GameSettingsFields, {
        errors: {},
        showCoreSettings: false,
        values: baseValues,
      }),
    );

    expect(creationMarkup).toContain("<span>03</span>当日のまとめ");
    expect(creationMarkup).toMatch(
      /<details class="settlement-cost-disclosure" open=""><summary/u,
    );
    expect(adminMarkup).toContain("SUMMARY");
    expect(adminMarkup).toContain("当日のまとめ");
    expect(adminMarkup).toMatch(
      /<details class="settlement-cost-disclosure"><summary/u,
    );
    expect(adminMarkup).toContain("当日の負担");
    expect(adminMarkup).toContain("実費 12,000円 ・ 8人想定 ・ 順位別配分");
  });

  it("BBレート0ではゲーム結果を閉じ、無効状態の説明を出さない", () => {
    const markup = renderToStaticMarkup(
      createElement(GameSettingsFields, { errors: {}, values: baseValues }),
    );

    expect(markup).toContain("<strong>ゲーム結果を反映</strong>");
    expect(markup).not.toContain("なし（会費のみ）");
    expect(markup).toContain('aria-label="BBレート"');
    expect(markup).toContain(">0P</button>");
    expect(markup).not.toContain("1BB = 0P");
    expect(markup).toMatch(/<details class="game-settlement-option"><summary/u);
  });

  it("BBレート有効時は現在値と100P単位調整を表示する", () => {
    const markup = renderToStaticMarkup(
      createElement(GameSettingsFields, {
        errors: {},
        values: { ...baseValues, bbRate: "5" },
      }),
    );

    expect(markup).toContain("1BB = 5P");
    expect(markup).toContain("100P単位で調整します");
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toMatch(/<details[^>]*\sopen(?:=|\s|>)/u);
  });

  it("終了入力が揃えばゲーム・負担・最終結果をプレビューする", () => {
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

    expect(markup).toContain("最終結果プレビュー");
    expect(markup).toContain("ゲーム +500P / 負担 -1,000P");
    expect(markup).toContain("-500P");
    expect(markup).toContain("-2,500P");
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
