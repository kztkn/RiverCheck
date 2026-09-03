export const PARTICIPANT_TABLE_STATUS_MAX_LENGTH = 24;

export type ParticipantTableStatusResult =
  | { ok: true; value: string | null }
  | { ok: false; error: string };

export function normalizeParticipantTableStatus(
  input: string,
): ParticipantTableStatusResult {
  const value = input.trim();
  if (/\r|\n/u.test(value)) {
    return { ok: false, error: "ひとことは1行で入力してください。" };
  }
  if (Array.from(value).length > PARTICIPANT_TABLE_STATUS_MAX_LENGTH) {
    return {
      ok: false,
      error: `ひとことは${PARTICIPANT_TABLE_STATUS_MAX_LENGTH}文字以内で入力してください。`,
    };
  }
  return { ok: true, value: value || null };
}
