import { describe, expect, it } from "vitest";
import {
  calculateChipDistributionFromInputs,
  gameConfigurationFromRecommendation,
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
});
