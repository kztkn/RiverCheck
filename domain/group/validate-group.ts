export const GROUP_NAME_MAX_LENGTH = 60;
export const GROUP_PUBLIC_CODE_MAX_LENGTH = 48;

const GROUP_PUBLIC_CODE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

export interface GroupIdentityValues {
  name: string;
  publicCode: string;
}

export type GroupIdentityErrors = Partial<
  Record<keyof GroupIdentityValues, string>
>;

export type GroupIdentityValidation =
  | { ok: true; values: GroupIdentityValues }
  | {
      ok: false;
      errors: GroupIdentityErrors;
      values: GroupIdentityValues;
    };

export function validateGroupIdentity(
  values: GroupIdentityValues,
): GroupIdentityValidation {
  const normalized = {
    name: values.name.trim(),
    publicCode: values.publicCode.trim().toLowerCase(),
  };
  const errors: GroupIdentityErrors = {};

  if (!normalized.name) {
    errors.name = "グループ名を入力してください。";
  } else if (Array.from(normalized.name).length > GROUP_NAME_MAX_LENGTH) {
    errors.name = `グループ名は${GROUP_NAME_MAX_LENGTH}文字以内で入力してください。`;
  }

  if (!normalized.publicCode) {
    errors.publicCode = "URL用コードを入力してください。";
  } else if (normalized.publicCode.length > GROUP_PUBLIC_CODE_MAX_LENGTH) {
    errors.publicCode = `URL用コードは${GROUP_PUBLIC_CODE_MAX_LENGTH}文字以内で入力してください。`;
  } else if (!GROUP_PUBLIC_CODE_PATTERN.test(normalized.publicCode)) {
    errors.publicCode = "半角英小文字・数字・ハイフンで入力してください。";
  }

  return Object.keys(errors).length > 0
    ? { ok: false, errors, values: normalized }
    : { ok: true, values: normalized };
}
