export const HIGHLIGHT_TEXT_MAX_LENGTH = 1000;
export const GAME_PHOTO_MAX_BYTES = 3 * 1024 * 1024;
export const GAME_PHOTO_MAX_LONG_EDGE = 1800;

export const ALLOWED_GAME_PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type GamePhotoContentType = (typeof ALLOWED_GAME_PHOTO_TYPES)[number];

export type HighlightValidationResult =
  | { ok: true; text: string | null }
  | { ok: false; error: string };

export function validateHighlightText(value: string): HighlightValidationResult {
  const text = value.trim();
  if (text.length > HIGHLIGHT_TEXT_MAX_LENGTH) {
    return {
      ok: false,
      error: `ハイライトは${HIGHLIGHT_TEXT_MAX_LENGTH}文字以内で入力してください。`,
    };
  }
  return { ok: true, text: text || null };
}

export function isAllowedGamePhotoType(
  value: string,
): value is GamePhotoContentType {
  return (ALLOWED_GAME_PHOTO_TYPES as readonly string[]).includes(value);
}

export function validateGamePhotoBytes(input: {
  bytes: Uint8Array;
  contentType: string;
  size: number;
}): { ok: true; contentType: GamePhotoContentType } | { ok: false; error: string } {
  if (!isAllowedGamePhotoType(input.contentType)) {
    return {
      ok: false,
      error: "写真はJPEG・PNG・WebPのいずれかを選択してください。",
    };
  }
  if (input.size < 1 || input.size > GAME_PHOTO_MAX_BYTES) {
    return {
      ok: false,
      error: "圧縮後の写真は3MB以内にしてください。",
    };
  }
  if (!matchesImageSignature(input.bytes, input.contentType)) {
    return {
      ok: false,
      error: "写真ファイルの内容を確認できませんでした。別の写真を選択してください。",
    };
  }
  return { ok: true, contentType: input.contentType };
}

export function calculateScaledPhotoSize(
  width: number,
  height: number,
  maxLongEdge = GAME_PHOTO_MAX_LONG_EDGE,
): { width: number; height: number } {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    !Number.isFinite(maxLongEdge) ||
    width <= 0 ||
    height <= 0 ||
    maxLongEdge <= 0
  ) {
    throw new RangeError("Photo dimensions must be positive finite numbers");
  }
  const scale = Math.min(1, maxLongEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function matchesImageSignature(
  bytes: Uint8Array,
  contentType: GamePhotoContentType,
): boolean {
  if (contentType === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (contentType === "image/png") {
    return (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }
  return (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  );
}
