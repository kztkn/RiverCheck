import { describe, expect, it } from "vitest";
import {
  countGameTitleCharacters,
  GAME_TITLE_MAX_LENGTH,
  GAME_TITLE_RECOMMENDED_LENGTH,
} from "./game-title";

describe("game title limits", () => {
  it("uses a mobile-friendly recommendation below the hard limit", () => {
    expect(GAME_TITLE_RECOMMENDED_LENGTH).toBe(20);
    expect(GAME_TITLE_MAX_LENGTH).toBe(30);
  });

  it("counts Japanese title characters consistently with HTML maxlength", () => {
    expect(countGameTitleCharacters("第3回ポーカー会 桜木町")).toBe(12);
  });
});
