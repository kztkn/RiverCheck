const MAX_OPEN_CHAT_URL_LENGTH = 500;

export type LineOpenChatLinkValidationResult =
  | { ok: true; value: string | null }
  | { ok: false; error: string };

export function validateLineOpenChatLink(
  rawValue: string,
): LineOpenChatLinkValidationResult {
  const value = rawValue.trim();
  if (!value) return { ok: true, value: null };

  if (value.length > MAX_OPEN_CHAT_URL_LENGTH) {
    return { ok: false, error: "URLが長すぎます。" };
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, error: "有効なURLを入力してください。" };
  }

  if (
    url.protocol !== "https:" ||
    url.hostname !== "line.me" ||
    !url.pathname.startsWith("/ti/g2/")
  ) {
    return {
      ok: false,
      error: "LINEオープンチャットの招待URLを入力してください。",
    };
  }

  return { ok: true, value: url.toString() };
}
