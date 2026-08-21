import { describe, expect, it } from "vitest";
import { decodeResultCode, encodeResultCode } from "./result-code";

describe("result code", () => {
  it("UUIDを22文字のURL安全なコードへ変換して復元する", () => {
    const gameId = "22222222-2222-4222-8222-222222222222";
    const resultCode = encodeResultCode(gameId);

    expect(resultCode).toMatch(/^[A-Za-z0-9_-]{22}$/u);
    expect(decodeResultCode(resultCode)).toBe(gameId);
  });

  it("大文字を含むUUIDも小文字へ正規化して復元する", () => {
    const resultCode = encodeResultCode(
      "FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF",
    );

    expect(decodeResultCode(resultCode)).toBe(
      "ffffffff-ffff-ffff-ffff-ffffffffffff",
    );
  });

  it.each(["", "short", "A".repeat(21), "A".repeat(23), "A".repeat(21) + "B"])(
    "不正または非正規のコードを拒否する: %s",
    (resultCode) => {
      expect(decodeResultCode(resultCode)).toBeNull();
    },
  );

  it("UUID以外は短縮しない", () => {
    expect(() => encodeResultCode("not-a-uuid")).toThrow(RangeError);
  });
});
