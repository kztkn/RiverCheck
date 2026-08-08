const COOKIE_NAME = "rc_player_profile";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function readPlayerProfileToken(request: Request): string | null {
  const cookieHeader = request.headers.get("Cookie") ?? "";
  for (const entry of cookieHeader.split(";")) {
    const separator = entry.indexOf("=");
    if (separator < 0 || entry.slice(0, separator).trim() !== COOKIE_NAME) {
      continue;
    }
    return decodeURIComponent(entry.slice(separator + 1).trim());
  }
  return null;
}

export function createPlayerProfileCookie(
  request: Request,
  token: string,
): string {
  return serializeCookie(request, token, ONE_YEAR_SECONDS);
}

export function clearPlayerProfileCookie(request: Request): string {
  return serializeCookie(request, "", 0);
}

function serializeCookie(
  request: Request,
  value: string,
  maxAge: number,
): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}
