interface CryptoUuidSource {
  getRandomValues?: (values: Uint8Array) => Uint8Array;
  randomUUID?: () => string;
}

/**
 * Creates an RFC 4122 version 4 UUID for idempotent browser commands.
 *
 * `crypto.randomUUID()` is unavailable on some mobile browsers when the app is
 * opened over plain HTTP from a LAN address. `getRandomValues()` remains
 * available there, so keep a UUID-compatible fallback for those devices.
 */
export function createCommandId(
  cryptoSource: CryptoUuidSource | undefined = globalThis.crypto,
  random: () => number = Math.random,
): string {
  if (typeof cryptoSource?.randomUUID === "function") {
    return cryptoSource.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof cryptoSource?.getRandomValues === "function") {
    cryptoSource.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hexadecimal = Array.from(bytes, (value) =>
    value.toString(16).padStart(2, "0"),
  );
  return [
    hexadecimal.slice(0, 4).join(""),
    hexadecimal.slice(4, 6).join(""),
    hexadecimal.slice(6, 8).join(""),
    hexadecimal.slice(8, 10).join(""),
    hexadecimal.slice(10).join(""),
  ].join("-");
}
