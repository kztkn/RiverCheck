import {
  validateGamePhotoBytes,
  type GamePhotoContentType,
} from "../highlight/validate-game-highlight";

export const PLAYER_DISPLAY_NAME_MAX_LENGTH = 10;
export const PLAYER_PROFILE_MESSAGE_MAX_LENGTH = 160;
export const PLAYER_AVATAR_MAX_BYTES = 1024 * 1024;
export const PLAYER_AVATAR_SIZE = 512;

export interface PlayerProfileFormValues {
  displayName: string;
  profileMessage: string;
}

export type PlayerProfileValidationResult =
  | {
      ok: true;
      values: { displayName: string; profileMessage: string | null };
    }
  | {
      ok: false;
      errors: Partial<Record<keyof PlayerProfileFormValues, string>>;
      values: PlayerProfileFormValues;
    };

export function validatePlayerProfile(
  values: PlayerProfileFormValues,
): PlayerProfileValidationResult {
  const displayName = values.displayName.trim();
  const profileMessage = values.profileMessage.trim();
  const errors: Partial<Record<keyof PlayerProfileFormValues, string>> = {};

  if (!displayName) {
    errors.displayName = "ユーザーネームを入力してください。";
  } else if (Array.from(displayName).length > PLAYER_DISPLAY_NAME_MAX_LENGTH) {
    errors.displayName = `ユーザーネームは${PLAYER_DISPLAY_NAME_MAX_LENGTH}文字以内で入力してください。`;
  }
  if (Array.from(profileMessage).length > PLAYER_PROFILE_MESSAGE_MAX_LENGTH) {
    errors.profileMessage = `一言メッセージは${PLAYER_PROFILE_MESSAGE_MAX_LENGTH}文字以内で入力してください。`;
  }

  return Object.keys(errors).length > 0
    ? { ok: false, errors, values }
    : {
        ok: true,
        values: { displayName, profileMessage: profileMessage || null },
      };
}

export function validatePlayerAvatarBytes(input: {
  bytes: Uint8Array;
  contentType: string;
  size: number;
}):
  | { ok: true; contentType: GamePhotoContentType }
  | { ok: false; error: string } {
  if (input.size > PLAYER_AVATAR_MAX_BYTES) {
    return { ok: false, error: "圧縮後のアイコンは1MB以内にしてください。" };
  }
  const result = validateGamePhotoBytes(input);
  if (!result.ok) {
    return { ok: false, error: result.error.replaceAll("写真", "アイコン") };
  }
  return result;
}
