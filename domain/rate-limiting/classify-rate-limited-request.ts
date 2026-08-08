export type RateLimitCategory =
  | "admin-write"
  | "organizer-login"
  | "participant-write";

const GROUP_PATH = String.raw`/g/[^/]+`;
const ORGANIZER_LOGIN_PATTERN = new RegExp(
  String.raw`^${GROUP_PATH}/organizer-login/?$`,
  "u",
);
const ADMIN_WRITE_PATTERN = new RegExp(
  String.raw`^${GROUP_PATH}/(?:players|games/(?:new|[^/]+/admin))/?$`,
  "u",
);
const PARTICIPANT_WRITE_PATTERN = new RegExp(
  String.raw`^${GROUP_PATH}/(?:games/[^/]+|profile(?:/claim/[^/]+)?)/?$`,
  "u",
);

export function classifyRateLimitedRequest(
  method: string,
  pathname: string,
): RateLimitCategory | null {
  if (method.toUpperCase() !== "POST") return null;
  if (ORGANIZER_LOGIN_PATTERN.test(pathname)) return "organizer-login";
  if (ADMIN_WRITE_PATTERN.test(pathname)) return "admin-write";
  if (PARTICIPANT_WRITE_PATTERN.test(pathname)) return "participant-write";
  return null;
}
