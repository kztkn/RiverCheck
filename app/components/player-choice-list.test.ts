import { describe, expect, it } from "vitest";
import { buildPlayerJoinConfirmation } from "./player-choice-list";

describe("player choice confirmation", () => {
  it("選択した本人名とログイン状態への影響を確認文に含める", () => {
    expect(buildPlayerJoinConfirmation("Alice")).toEqual({
      description:
        "参加すると、この端末ではAliceのプロフィールとしてログイン状態になります。",
      title: "Aliceとして参加しますか？",
    });
  });
});
