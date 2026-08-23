import { describe, expect, it, vi } from "vitest";

vi.mock("@server/repositories/game-repository.server", () => ({
  insertGame: vi.fn(),
}));
vi.mock("@server/repositories/group-repository.server", () => ({
  findGroupByPublicCode: vi.fn(),
}));

import {
  readGameSettingsForm,
  validateGameSettingsForm,
  type GameSettingsFormValues,
} from "@server/services/game-service.server";

const validValues: GameSettingsFormValues = {
  title: "8月のポーカー会",
  playedAt: "2026-08-16",
  initialChips: "20000",
  venueCost: "11330",
  firstPlaceCost: "1800",
  secondPlaceCost: "2000",
  thirdPlaceCost: "2300",
  previewParticipantCount: "5",
  costShares: ["1800", "2000", "2300", "2500", "2800"],
  sevenDeuceRuleEnabled: true,
  bombPotRuleEnabled: true,
};

describe("game settings cost shares", () => {
  it("全順位の配分を順位順のまま読み取る", () => {
    const formData = new FormData();
    formData.set("title", validValues.title);
    formData.set("playedAt", validValues.playedAt);
    formData.set("initialChips", validValues.initialChips);
    formData.set("venueCost", validValues.venueCost);
    formData.set(
      "previewParticipantCount",
      validValues.previewParticipantCount,
    );
    formData.set("sevenDeuceRuleEnabled", "yes");
    formData.set("bombPotRuleEnabled", "yes");
    validValues.costShares.forEach((share) =>
      formData.append("costShare", share),
    );

    expect(readGameSettingsForm(formData)).toMatchObject({
      costShares: validValues.costShares,
      sevenDeuceRuleEnabled: true,
      bombPotRuleEnabled: true,
    });
  });

  it("72oルールのチェックがなければOFFとして読み取る", () => {
    expect(readGameSettingsForm(new FormData()).sevenDeuceRuleEnabled).toBe(
      false,
    );
  });

  it("ボムポットのチェックがなければOFFとして読み取る", () => {
    expect(readGameSettingsForm(new FormData()).bombPotRuleEnabled).toBe(false);
  });

  it("合計一致した全順位配分を保存用入力へ変換する", () => {
    const result = validateGameSettingsForm(validValues);

    expect(result).toMatchObject({
      ok: true,
      input: {
        firstPlaceCost: 1800,
        secondPlaceCost: 2000,
        thirdPlaceCost: 2300,
        costShares: [1800, 2000, 2300, 2500, 2800],
        sevenDeuceRuleEnabled: true,
        bombPotRuleEnabled: true,
      },
    });
  });

  it("負担額合計が不足する配分を拒否する", () => {
    const result = validateGameSettingsForm({
      ...validValues,
      costShares: ["1800", "2000", "2300", "2500", "2500"],
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        errors: expect.objectContaining({
          costShares: expect.stringContaining("300円不足"),
        }),
      }),
    );
  });

  it("負担額合計が超過する配分を拒否する", () => {
    const result = validateGameSettingsForm({
      ...validValues,
      costShares: ["1800", "2000", "2300", "2500", "3000"],
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        errors: expect.objectContaining({
          costShares: expect.stringContaining("200円多い"),
        }),
      }),
    );
  });

  it("100円単位でない配分を拒否する", () => {
    const result = validateGameSettingsForm({
      ...validValues,
      costShares: ["1850", "1950", "2300", "2500", "2800"],
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        errors: expect.objectContaining({
          costShares: expect.stringContaining("100円単位"),
        }),
      }),
    );
  });

  it("順位傾斜が逆転した配分を拒否する", () => {
    const result = validateGameSettingsForm({
      ...validValues,
      costShares: ["1800", "2000", "2500", "2400", "2700"],
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        errors: expect.objectContaining({
          costShares: expect.stringContaining("4位は3位以上"),
        }),
      }),
    );
  });
});
