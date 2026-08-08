const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function cookieName(gameId: string): string {
  return `rc_participant_${gameId.replaceAll("-", "")}`;
}

export function readParticipantToken(
  request: Request,
  gameId: string,
): string | null {
  const targetName = cookieName(gameId);
  const cookieHeader = request.headers.get("Cookie") ?? "";

  for (const entry of cookieHeader.split(";")) {
    const separator = entry.indexOf("=");
    if (separator < 0) continue;
    const name = entry.slice(0, separator).trim();
    if (name !== targetName) continue;
    return decodeURIComponent(entry.slice(separator + 1).trim());
  }

  return null;
}

export function createParticipantCookie(
  request: Request,
  groupCode: string,
  gameId: string,
  token: string,
): string {
  return serializeCookie(request, groupCode, gameId, token, ONE_YEAR_SECONDS);
}

export function clearParticipantCookie(
  request: Request,
  groupCode: string,
  gameId: string,
): string {
  return serializeCookie(request, groupCode, gameId, "", 0);
}

function serializeCookie(
  request: Request,
  groupCode: string,
  gameId: string,
  value: string,
  maxAge: number,
): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${cookieName(gameId)}=${encodeURIComponent(value)}; Path=/g/${groupCode}/games/${gameId}; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}
