const TOKEN_BYTE_LENGTH = 32;

export function generateOpaqueToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTE_LENGTH));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );

  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function constantTimeEqual(left: string, right: string): boolean {
  const normalizedRight = right.trim().toLowerCase();
  const maxLength = Math.max(left.length, normalizedRight.length);
  let difference = left.length ^ normalizedRight.length;
  for (let index = 0; index < maxLength; index += 1) {
    difference |=
      (left.charCodeAt(index) || 0) ^ (normalizedRight.charCodeAt(index) || 0);
  }

  return difference === 0;
}
