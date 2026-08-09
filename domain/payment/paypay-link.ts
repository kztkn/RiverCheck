export const PAYPAY_LINK_VALIDITY_DAYS = 14;
export const PAYPAY_LINK_MAX_LENGTH = 2_048;
const PAYPAY_LINK_VALIDITY_MS =
  PAYPAY_LINK_VALIDITY_DAYS * 24 * 60 * 60 * 1_000;

export function validatePayPayRecipientLink(value: string):
  | { ok: true; value: string | null }
  | { ok: false; error: string } {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, value: null };
  if (trimmed.length > PAYPAY_LINK_MAX_LENGTH) {
    return { ok: false, error: "PayPay受取リンクが長すぎます。" };
  }

  try {
    const url = new URL(trimmed);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password
    ) {
      return invalidLink();
    }
  } catch {
    return invalidLink();
  }
  return { ok: true, value: trimmed };
}

export function getPayPayLinkExpiresAt(registeredAt: string): string {
  return new Date(
    new Date(registeredAt).getTime() + PAYPAY_LINK_VALIDITY_MS,
  ).toISOString();
}

export function isPayPayLinkActive(input: {
  link: string | null;
  registeredAt: string | null;
  now?: Date;
}): boolean {
  if (!input.link || !input.registeredAt) return false;
  const registeredAt = new Date(input.registeredAt).getTime();
  if (!Number.isFinite(registeredAt)) return false;
  return (input.now ?? new Date()).getTime() <
    registeredAt + PAYPAY_LINK_VALIDITY_MS;
}

function invalidLink(): { ok: false; error: string } {
  return {
    ok: false,
    error: "https:// で始まる受取リンクを入力してください。",
  };
}
