export function extractGroupCode(pathname: string): string | null {
  const normalizedPathname = pathname.replace(/\.data$/u, "");
  const match = /^\/g\/([^/]+)/u.exec(normalizedPathname);
  if (!match?.[1]) return null;

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}
