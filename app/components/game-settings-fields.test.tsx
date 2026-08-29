import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GameSettingsFields, type GameSettingsValues } from "./game-settings-fields";

const baseValues: GameSettingsValues = {
  title: "テスト開催",
  playedAt: "2026-08-29",
  initialChips: "20000",
  venueCost: "12000",
  firstPlaceCost: "0",
  secondPlaceCost: "500",
  thirdPlaceCost: "1000",
  previewParticipantCount: "8",
  costShares: ["0", "500", "1000", "2100", "2100", "2100", "2100", "2100"],
  sevenDeuceRuleEnabled: true,
  bombPotRuleEnabled: true,
};

describe("GameSettingsFields local rules", () => {
  it("ローカルルールを初期状態では閉じ、現在のON/OFFを要約表示する", () => {
    const markup = renderToStaticMarkup(
      createElement(GameSettingsFields, { errors: {}, values: baseValues }),
    );

    expect(markup).toContain('class="local-rules-disclosure"');
    expect(markup).toContain("72o ON ・ ボムポット ON");
    expect(markup).not.toContain('class="local-rules-disclosure" open');
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
