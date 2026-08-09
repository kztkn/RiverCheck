import { describe, expect, it } from "vitest";
import {
  calculateScaledPhotoSize,
  GAME_PHOTO_MAX_BYTES,
  validateGamePhotoBytes,
  validateHighlightText,
} from "./validate-game-highlight";

describe("validateHighlightText", () => {
  it("空白だけの文章は未登録として扱う", () => {
    expect(validateHighlightText("  \n ")).toEqual({ ok: true, text: null });
  });

  it("前後空白を除去し300文字を超える文章を拒否する", () => {
    expect(validateHighlightText("  ナイスハンド  ")).toEqual({
      ok: true,
      text: "ナイスハンド",
    });
    expect(validateHighlightText("あ".repeat(301))).toEqual({
      ok: false,
      error: "ハイライトは300文字以内で入力してください。",
    });
  });
});

describe("validateGamePhotoBytes", () => {
  it("JPEG・PNG・WebPの実ファイルシグネチャを受け付ける", () => {
    expect(
      validateGamePhotoBytes({
        bytes: new Uint8Array([0xff, 0xd8, 0xff]),
        contentType: "image/jpeg",
        size: 3,
      }).ok,
    ).toBe(true);
    expect(
      validateGamePhotoBytes({
        bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        contentType: "image/png",
        size: 8,
      }).ok,
    ).toBe(true);
    expect(
      validateGamePhotoBytes({
        bytes: new Uint8Array([
          0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
        ]),
        contentType: "image/webp",
        size: 12,
      }).ok,
    ).toBe(true);
  });

  it("偽装content typeと3MB超過を拒否する", () => {
    expect(
      validateGamePhotoBytes({
        bytes: new Uint8Array([1, 2, 3]),
        contentType: "image/jpeg",
        size: 3,
      }).ok,
    ).toBe(false);
    expect(
      validateGamePhotoBytes({
        bytes: new Uint8Array([0xff, 0xd8, 0xff]),
        contentType: "image/jpeg",
        size: GAME_PHOTO_MAX_BYTES + 1,
      }).ok,
    ).toBe(false);
  });
});

describe("calculateScaledPhotoSize", () => {
  it("長辺1800px以内へ縦横比を保って縮小し、拡大はしない", () => {
    expect(calculateScaledPhotoSize(4000, 3000)).toEqual({
      width: 1800,
      height: 1350,
    });
    expect(calculateScaledPhotoSize(800, 1200)).toEqual({
      width: 800,
      height: 1200,
    });
  });
});
