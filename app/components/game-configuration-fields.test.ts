import { describe, expect, it, vi } from "vitest";
import {
  calculateChipDistributionFromInputs,
  closeChipCalculator,
  gameConfigurationFromRecommendation,
  gameConfigurationWithBigBlind,
  gameConfigurationWithBigBlindAnte,
  gameConfigurationWithStackDepth,
  scrollToAppliedGameConfiguration,
  type GameConfigurationValues,
} from "./game-configuration-fields";

describe("chip calculator form integration", () => {
  const parentValues: GameConfigurationValues = {
    initialChips: "500",
    smallBlindChips: "10",
    bigBlindChips: "20",
    bigBlindAnteChips: "20",
  };

  it("計算しただけでは親ゲーム設定を変更しない", () => {
    const before = { ...parentValues };
    const result = calculateChipDistributionFromInputs([
      "10000",
      "5000",
      "1000",
      "500",
      "100",
      "50",
    ]);
    expect(result.ok).toBe(true);
    expect(parentValues).toEqual(before);
  });

  it("明示反映したときだけ4つの正本値へ変換する", () => {
    const result = calculateChipDistributionFromInputs([
      "10000",
      "5000",
      "1000",
      "500",
      "100",
      "50",
    ]);
    if (!result.ok) throw new Error(result.error);
    expect(gameConfigurationFromRecommendation(result.recommendation)).toEqual({
      initialChips: "20000",
      smallBlindChips: "100",
      bigBlindChips: "200",
      bigBlindAnteChips: "200",
    });
    expect(parentValues).toEqual({
      initialChips: "500",
      smallBlindChips: "10",
      bigBlindChips: "20",
      bigBlindAnteChips: "20",
    });
  });

  it("ゲーム設定へ反映したらチップ構成計算を閉じる", () => {
    const disclosure = { open: true };
    closeChipCalculator(disclosure);
    expect(disclosure.open).toBe(false);
  });

  it("反映後のゲーム設定が見える位置へ移動する", () => {
    const scrollIntoView = vi.fn();
    scrollToAppliedGameConfiguration({ scrollIntoView });
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "center",
    });
  });

  it("BB変更時にBBAを同額へ追従させる", () => {
    expect(gameConfigurationWithBigBlind(parentValues, "25")).toEqual({
      ...parentValues,
      initialChips: "625",
      bigBlindChips: "25",
      bigBlindAnteChips: "25",
    });
  });

  it("BB変更時も選択中の100BBを維持して初期チップを再計算する", () => {
    expect(
      gameConfigurationWithBigBlind(
        {
          ...parentValues,
          initialChips: "20000",
          bigBlindChips: "200",
          bigBlindAnteChips: "200",
        },
        "400",
        100,
      ),
    ).toEqual({
      ...parentValues,
      initialChips: "40000",
      bigBlindChips: "400",
      bigBlindAnteChips: "400",
    });
  });

  it("既存のBBAなし開催はBB変更時も0を維持する", () => {
    expect(
      gameConfigurationWithBigBlind(
        { ...parentValues, bigBlindAnteChips: "0" },
        "25",
      ),
    ).toEqual({
      ...parentValues,
      initialChips: "625",
      bigBlindChips: "25",
      bigBlindAnteChips: "0",
    });
  });

  it("BBAのあり・なしをBBと同額または0へ変換する", () => {
    expect(gameConfigurationWithBigBlindAnte(parentValues, false)).toEqual({
      ...parentValues,
      bigBlindAnteChips: "0",
    });
    expect(
      gameConfigurationWithBigBlindAnte(
        { ...parentValues, bigBlindAnteChips: "0" },
        true,
      ),
    ).toEqual(parentValues);
  });

  it("選択した開始BBから初期チップだけを正方向へ計算する", () => {
    expect(gameConfigurationWithStackDepth(parentValues, 25)).toEqual({
      ...parentValues,
      initialChips: "500",
    });
    expect(gameConfigurationWithStackDepth(parentValues, 150)).toEqual({
      ...parentValues,
      initialChips: "3000",
    });
  });
});
