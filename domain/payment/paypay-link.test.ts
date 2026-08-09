import { describe, expect, it } from "vitest";
import {
  getPayPayLinkExpiresAt,
  isPayPayLinkActive,
  validatePayPayRecipientLink,
} from "./paypay-link";

describe("validatePayPayRecipientLink", () => {
  it.each([
    [" https://qr.paypay.ne.jp/abc123 ", "https://qr.paypay.ne.jp/abc123"],
    ["https://pay.paypay.ne.jp/xyz789", "https://pay.paypay.ne.jp/xyz789"],
    ["https://example.com/payment", "https://example.com/payment"],
  ])("HTTPSの受取リンクを許可する: %s", (value, expected) => {
    expect(
      validatePayPayRecipientLink(value),
    ).toEqual({ ok: true, value: expected });
  });

  it("空欄をリンク削除として許可する", () => {
    expect(validatePayPayRecipientLink("  ")).toEqual({
      ok: true,
      value: null,
    });
  });

  it.each([
    "http://qr.paypay.ne.jp/abc123",
    "javascript:alert(1)",
    "not-a-url",
    "https://user:password@example.com/payment",
  ])("安全なHTTPS URLではない値を拒否する: %s", (value) => {
    expect(validatePayPayRecipientLink(value).ok).toBe(false);
  });
});

describe("PayPay link expiry", () => {
  const registeredAt = "2026-08-01T00:00:00.000Z";

  it("登録日時から14日後を返す", () => {
    expect(getPayPayLinkExpiresAt(registeredAt)).toBe(
      "2026-08-15T00:00:00.000Z",
    );
  });

  it("14日になる直前は有効、ちょうど14日で期限切れ", () => {
    const input = {
      link: "https://qr.paypay.ne.jp/abc123",
      registeredAt,
    };
    expect(
      isPayPayLinkActive({ ...input, now: new Date("2026-08-14T23:59:59.999Z") }),
    ).toBe(true);
    expect(
      isPayPayLinkActive({ ...input, now: new Date("2026-08-15T00:00:00.000Z") }),
    ).toBe(false);
  });
});
