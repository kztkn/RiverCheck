import { describe, expect, it } from "vitest";
import {
  calculateInitialStackBb,
  calculateLegacyBlindStructure,
  calculateChipsPerBb,
  calculateNetBb,
  formatChipsPerBb,
  formatNetBb,
  formatSignedBbValue,
} from "./bb-score";

describe("BB score", () => {
  it("1BBあたりのチップ量を計算・表示する", () => {
    expect(calculateChipsPerBb(200)).toBe(200);
    expect(formatChipsPerBb(200)).toBe("200");
  });

  it("初期100BBを引いた損益を計算する", () => {
    expect(
      calculateNetBb({
        score: 20_000,
        initialChips: 20_000,
        bigBlindChips: 200,
      }),
    ).toBe(0);
    expect(
      calculateNetBb({
        score: -180_000,
        initialChips: 20_000,
        bigBlindChips: 200,
      }),
    ).toBe(-1_000);
  });

  it("legacy開催だけ初期チップと開始BBからブラインドを復元する", () => {
    expect(calculateLegacyBlindStructure(20_000, 100)).toEqual({
      smallBlindChips: 100,
      bigBlindChips: 200,
      bigBlindAnteChips: 200,
    });
    expect(calculateLegacyBlindStructure(10_000, 100)).toEqual({
      smallBlindChips: 50,
      bigBlindChips: 100,
      bigBlindAnteChips: 100,
    });
  });

  it("保存されたBBチップ量を正本として損益を換算する", () => {
    expect(calculateInitialStackBb(20_000, 400)).toBe(50);
    expect(
      formatNetBb({
        score: 40_000,
        initialChips: 20_000,
        bigBlindChips: 400,
      }),
    ).toBe("+50BB");
    expect(
      formatNetBb({
        score: 0,
        initialChips: 20_000,
        bigBlindChips: 400,
      }),
    ).toBe("-50BB");
  });

  it("500チップを10/20で始めた開催は25BBとして扱う", () => {
    expect(calculateInitialStackBb(500, 20)).toBe(25);
    expect(
      calculateNetBb({ score: 700, initialChips: 500, bigBlindChips: 20 }),
    ).toBe(10);
  });

  it("損益BBを初期スタック0BB基準で表示する", () => {
    expect(
      formatNetBb({ score: 40_000, initialChips: 20_000, bigBlindChips: 200 }),
    ).toBe("+100BB");
    expect(
      formatNetBb({ score: 20_000, initialChips: 20_000, bigBlindChips: 200 }),
    ).toBe("0BB");
    expect(
      formatNetBb({ score: 10_000, initialChips: 20_000, bigBlindChips: 200 }),
    ).toBe("-50BB");
    expect(
      formatNetBb({ score: 0, initialChips: 20_000, bigBlindChips: 200 }),
    ).toBe("-100BB");
  });

  it("戦績の正負と小数を読みやすく表示する", () => {
    expect(formatSignedBbValue(12.345)).toBe("+12.35BB");
    expect(formatSignedBbValue(0)).toBe("0BB");
    expect(formatSignedBbValue(-7.5)).toBe("-7.5BB");
  });

  it("初期チップ0は拒否する", () => {
    expect(() =>
      calculateNetBb({ score: 0, initialChips: 0, bigBlindChips: 200 }),
    ).toThrow(RangeError);
  });

  it("開始チップがBBの整数倍でない設定は派生キャッシュを作らない", () => {
    expect(() => calculateInitialStackBb(500, 30)).toThrow(RangeError);
  });
});
