export const INVITE_REQUIRED_RESPONSE_TEXT = "invite-required";

export function isPublicGroupEntryPath(
  pathname: string,
  groupCode: string,
): boolean {
  const normalizedPathname = pathname.replace(/\.data$/u, "");
  const segments = normalizedPathname.split("/").filter(Boolean);
  if (segments[0] !== "g") return false;

  let decodedGroupCode: string;
  try {
    decodedGroupCode = decodeURIComponent(segments[1] ?? "");
  } catch {
    return false;
  }
  if (decodedGroupCode !== groupCode) return false;

  const rest = segments.slice(2);
  if (rest.length === 1 && rest[0] === "organizer-login") return true;
  if (
    rest.length === 3 &&
    rest[0] === "profile" &&
    rest[1] === "claim" &&
    Boolean(rest[2])
  ) {
    return true;
  }
  if (
    rest.length === 3 &&
    rest[0] === "players" &&
    Boolean(rest[1]) &&
    rest[2] === "avatar"
  ) {
    return true;
  }
  return rest.length === 2 && rest[0] === "games" && Boolean(rest[1]);
}
