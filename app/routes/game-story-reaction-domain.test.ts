import { describe, expect, it } from "vitest";
import {
  GAME_STORY_REACTION_TYPES,
  isGameStoryReactionType,
} from "@domain/story/game-story-reaction";
import { buildGameStoryReactionPath } from "~/components/game-story-reactions";
import { classifyRateLimitedRequest } from "@domain/rate-limiting/classify-rate-limited-request";

describe("game story reactions", () => {
  it("第一弾の5種類だけを受け付ける", () => {
    expect(GAME_STORY_REACTION_TYPES).toEqual([
      "laugh",
      "fire",
      "shock",
      "nice",
      "respect",
    ]);
    expect(isGameStoryReactionType("laugh")).toBe(true);
    expect(isGameStoryReactionType("custom")).toBe(false);
  });

  it("開催結果画面から専用resource routeを組み立てる", () => {
    expect(buildGameStoryReactionPath("/g/home/games/game-1")).toBe(
      "/g/home/games/game-1/story-reactions",
    );
    expect(buildGameStoryReactionPath("/g/home/games/game-1/")).toBe(
      "/g/home/games/game-1/story-reactions",
    );
    expect(buildGameStoryReactionPath("/g/home/games/game-1/admin")).toBeNull();
  });

  it("リアクションPOSTをparticipant writeとしてrate limitする", () => {
    expect(
      classifyRateLimitedRequest(
        "POST",
        "/g/home/games/00000000-0000-4000-8000-000000000001/story-reactions",
      ),
    ).toBe("participant-write");
  });
});
