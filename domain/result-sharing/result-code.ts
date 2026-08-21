const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]{22}$/u;
const BASE64URL_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export function encodeResultCode(gameId: string): string {
  if (!UUID_PATTERN.test(gameId)) {
    throw new RangeError("gameId must be a UUID");
  }

  const hex = gameId.replaceAll("-", "");
  const bytes = Array.from({ length: 16 }, (_, index) =>
    Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16),
  );
  let result = "";
  let buffer = 0;
  let bitCount = 0;

  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bitCount += 8;
    while (bitCount >= 6) {
      bitCount -= 6;
      result += BASE64URL_ALPHABET[(buffer >> bitCount) & 0x3f];
      buffer &= (1 << bitCount) - 1;
    }
  }
  if (bitCount > 0) {
    result += BASE64URL_ALPHABET[(buffer << (6 - bitCount)) & 0x3f];
  }

  return result;
}

export function decodeResultCode(resultCode: string): string | null {
  if (!BASE64URL_PATTERN.test(resultCode)) return null;

  const bytes: number[] = [];
  let buffer = 0;
  let bitCount = 0;

  for (const character of resultCode) {
    const value = BASE64URL_ALPHABET.indexOf(character);
    if (value < 0) return null;
    buffer = (buffer << 6) | value;
    bitCount += 6;
    while (bitCount >= 8) {
      bitCount -= 8;
      bytes.push((buffer >> bitCount) & 0xff);
      buffer &= (1 << bitCount) - 1;
    }
  }

  if (bytes.length !== 16 || bitCount !== 4 || buffer !== 0) return null;
  const hex = bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}
