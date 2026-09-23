import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  updateOpenGameConfiguration: vi.fn(),
}));

vi.mock("@server/repositories/game-repository.server", () => ({
  deleteOpenGame: vi.fn(),
  insertGame: vi.fn(),
  updateOpenGameConfiguration: mocked.updateOpenGameConfiguration,
  updateOpenGameTitle: vi.fn(),
}));
vi.mock("@server/repositories/group-repository.server", () => ({
  findGroupByPublicCode: vi.fn(),
}));
vi.mock("@server/services/push-notification-service.server", () => ({
  notifyNewGameCreated: vi.fn(),
}));

import {
  readGameSettingsForm,
  updateOpenGameConfigurationForGroup,
  validateGameConfigurationForm,
  validateGameSettingsForm,
  type GameSettingsFormValues,
} from "@server/services/game-service.server";

const validValues: GameSettingsFormValues = {
  title: "8月のポーカー会",
  playedAt: "2026-08-16",
  initialChips: "20000",
  initialStackBb: "100",
  venueCost: "11330",
  firstPlaceCost: "1800",
  secondPlaceCost: "2000",
  thirdPlaceCost: "2300",
  previewParticipantCount: "5",
  costShares: ["1800", "2000", "2300", "2500", "2800"],
  bbRate: "0",
  sevenDeuceRuleEnabled: true,
  bombPotRuleEnabled: true,
};

describe("open game configuration", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("初期チップと開始BBを整数へ変換する", () => {
    expect(
      validateGameConfigurationForm({
        initialChips: "10000",
        initialStackBb: "50",
      }),
    ).toEqual({
      ok: true,
      input: { initialChips: 10_000, initialStackBb: 50 },
    });
  });

  it("初期チップ0と未対応の開始BBを拒否する", () => {
    expect(
      validateGameConfigurationForm({
        initialChips: "0",
        initialStackBb: "75",
      }),
    ).toEqual({
      ok: false,
      errors: {
        initialChips: "1以上の整数で入力してください。",
        initialStackBb: "開始スタックは25BB、50BB、100BBから選んでください。",
      },
    });
  });

  it("25BB開始を許可する", () => {
    expect(
      validateGameConfigurationForm({
        initialChips: "500",
        initialStackBb: "25",
      }),
    ).toEqual({
      ok: true,
      input: { initialChips: 500, initialStackBb: 25 },
    });
  });

  it("記録済みなら影響確認を要求する", async () => {
    mocked.updateOpenGameConfiguration.mockResolvedValue(
      "confirmation-required",
    );

    await expect(
      updateOpenGameConfigurationForGroup(
        "group-1",
        "game-1",
        { initialChips: "10000", initialStackBb: "50" },
        false,
      ),
    ).resolves.toMatchObject({
      ok: false,
      confirmationRequired: true,
      errors: {},
    });
  });

  it("確認済みのゲーム設定をrepositoryへ渡す", async () => {
    mocked.updateOpenGameConfiguration.mockResolvedValue("updated");

    await expect(
      updateOpenGameConfigurationForGroup(
        "group-1",
        "game-1",
        { initialChips: "10000", initialStackBb: "50" },
        true,
      ),
    ).resolves.toEqual({ ok: true });
    expect(mocked.updateOpenGameConfiguration).toHaveBeenCalledWith(
      "group-1",
      "game-1",
      { initialChips: 10_000, initialStackBb: 50 },
      true,
    );
  });
});

describe("game settings cost shares", () => {
  it("全順位の配分を順位順のまま読み取る", () => {
    const formData = new FormData();
    formData.set("title", validValues.title);
    formData.set("playedAt", validValues.playedAt);
    formData.set("initialChips", validValues.initialChips);
    formData.set("initialStackBb", "50");
    formData.set("venueCost", validValues.venueCost);
    formData.set(
      "previewParticipantCount",
      validValues.previewParticipantCount,
    );
    formData.set("sevenDeuceRuleEnabled", "yes");
    formData.set("bombPotRuleEnabled", "yes");
    formData.set("bbRate", "5");
    validValues.costShares.forEach((share) =>
      formData.append("costShare", share),
    );

    expect(readGameSettingsForm(formData)).toMatchObject({
      costShares: validValues.costShares,
      sevenDeuceRuleEnabled: true,
      bombPotRuleEnabled: true,
      bbRate: "5",
      initialStackBb: "50",
    });
  });

  it("ルールのチェックがなければOFFとして読み取る", () => {
    expect(readGameSettingsForm(new FormData())).toMatchObject({
      sevenDeuceRuleEnabled: false,
      bombPotRuleEnabled: false,
    });
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
        bbRate: 0,
      },
    });
  });

  it("BBレートが未送信なら後方互換の0として扱う", () => {
    expect(readGameSettingsForm(new FormData()).bbRate).toBe("");
    expect(validateGameSettingsForm({ ...validValues, bbRate: "" })).toEqual(
      expect.objectContaining({
        ok: true,
        input: expect.objectContaining({ bbRate: 0 }),
      }),
    );
  });

  it("開始スタックが未送信なら後方互換の100BBとして扱う", () => {
    expect(readGameSettingsForm(new FormData()).initialStackBb).toBe("");
    expect(
      validateGameSettingsForm({ ...validValues, initialStackBb: "" }),
    ).toEqual(
      expect.objectContaining({
        ok: true,
        input: expect.objectContaining({ initialStackBb: 100 }),
      }),
    );
  });

  it("50BB開始を保存用入力へ変換する", () => {
    expect(
      validateGameSettingsForm({ ...validValues, initialStackBb: "50" }),
    ).toEqual(
      expect.objectContaining({
        ok: true,
        input: expect.objectContaining({
          initialStackBb: 50,
          initialChips: 20_000,
          rebuyChips: 20_000,
        }),
      }),
    );
  });

  it("プリセット外の開始スタックを拒否する", () => {
    expect(
      validateGameSettingsForm({ ...validValues, initialStackBb: "75" }),
    ).toEqual(
      expect.objectContaining({
        ok: false,
        errors: expect.objectContaining({ initialStackBb: expect.stringContaining("50BB") }),
      }),
    );
  });

  it("プリセット外のBBレートを拒否する", () => {
    expect(validateGameSettingsForm({ ...validValues, bbRate: "7" })).toEqual(
      expect.objectContaining({
        ok: false,
        errors: expect.objectContaining({ bbRate: expect.stringContaining("5円") }),
      }),
    );
  });

  it("2人配分は最後の順位をlegacy 3位列の互換値に使う", () => {
    const result = validateGameSettingsForm({
      ...validValues,
      venueCost: "3000",
      previewParticipantCount: "2",
      costShares: ["1000", "2000"],
    });

    expect(result).toMatchObject({
      ok: true,
      input: {
        costShares: [1_000, 2_000],
        firstPlaceCost: 1_000,
        secondPlaceCost: 2_000,
        thirdPlaceCost: 2_000,
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
