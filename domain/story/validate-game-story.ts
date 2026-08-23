export const GAME_STORY_BODY_MAX_LENGTH = 160;

export type GameStoryBodyValidationResult =
  | { ok: true; body: string | null }
  | { ok: false; error: string };

export function validateGameStoryBody(
  value: string,
): GameStoryBodyValidationResult {
  const body = value.trim();
  if (body.length > GAME_STORY_BODY_MAX_LENGTH) {
    return {
      ok: false,
      error: `ひとことは${GAME_STORY_BODY_MAX_LENGTH}文字以内で入力してください。`,
    };
  }
  return { ok: true, body: body || null };
}
