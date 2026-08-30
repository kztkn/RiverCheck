export const DEFAULT_GROUP_CODE = "river-check";
export const LAST_VISITED_GROUP_STORAGE_KEY = "rivercheck:last-visited-group:v1";

const GROUP_CODE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

export function isValidGroupCode(value: string): boolean {
  return value.length > 0 && value.length <= 48 && GROUP_CODE_PATTERN.test(value);
}

export function readLastVisitedGroup(
  storage: Pick<Storage, "getItem">,
): string | null {
  try {
    const value = storage.getItem(LAST_VISITED_GROUP_STORAGE_KEY);
    return value && isValidGroupCode(value) ? value : null;
  } catch {
    return null;
  }
}

export function rememberLastVisitedGroup(
  storage: Pick<Storage, "setItem">,
  groupCode: string,
): void {
  if (!isValidGroupCode(groupCode)) return;
  try {
    storage.setItem(LAST_VISITED_GROUP_STORAGE_KEY, groupCode);
  } catch {
    // Storage may be blocked by browser privacy settings. Navigation still works.
  }
}
