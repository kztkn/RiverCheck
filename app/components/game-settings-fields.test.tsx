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
    expect(markup).toContain("BBは変えず、初期チップだけを調整します。");
    expect(markup).toContain("リバイも開始時と同じチップ枚数・BBです。");
  });

  it("SB・BB・BBAを明示値として見える化する", () => {
    const standardMarkup = renderToStaticMarkup(
      createElement(GameSettingsFields, { errors: {}, values: baseValues }),
    );
    expect(standardMarkup).toContain("今回のゲーム設定");
    expect(standardMarkup).toContain("<small>SB</small><strong>100</strong>");
    expect(standardMarkup).toContain("<small>BB</small><strong>200</strong>");
    expect(standardMarkup).toContain("<small>BBA</small><strong>200</strong>");

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
    expect(compactMarkup).toContain("開始スタック <strong>50BB</strong>");
    expect(compactMarkup).toContain("1BB = 200チップ");
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
