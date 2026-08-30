import { describe, expect, it } from "vitest";
import {
  buildPlayerJoinConfirmation,
  buildPlayerSwitchConfirmation,
} from "~/components/player-choice-list";

describe("player choice confirmation copy", () => {
  it("keeps the open-game join confirmation unchanged", () => {
    expect(buildPlayerJoinConfirmation("Alice")).toEqual({
      title: "Aliceとして参加しますか？",
      description: "参加すると、この端末ではAliceのプロフィールとしてログイン状態になります。",
    });
  });

  it("explains that a device-player switch preserves profile and stats", () => {
    expect(buildPlayerSwitchConfirmation("Bob")).toEqual({
      title: "この端末をBobに変更しますか？",
      description: "変更すると、この端末では次回からBobとして開きます。現在のプロフィールや戦績は削除されません。",
    });
  });
});
