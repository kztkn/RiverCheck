import { describe, expect, it } from "vitest";
import {
  GAME_STORY_BODY_MAX_LENGTH,
  validateGameStoryBody,
} from "./validate-game-story";

describe("validateGameStoryBody", () => {
  it("空白だけなら投稿なしとして扱う", () => {
    expect(validateGameStoryBody("  \n ")).toEqual({ ok: true, body: null });
  });

  it("前後の空白を除いて本文を返す", () => {
    expect(validateGameStoryBody("  楽しかった！  ")).toEqual({
      ok: true,
      body: "楽しかった！",
    });
  });

  it("上限を超える本文を拒否する", () => {
    expect(
      validateGameStoryBody("あ".repeat(GAME_STORY_BODY_MAX_LENGTH + 1)),
    ).toEqual({
      ok: false,
      error: `ひとことは${GAME_STORY_BODY_MAX_LENGTH}文字以内で入力してください。`,
    });
  });
});
