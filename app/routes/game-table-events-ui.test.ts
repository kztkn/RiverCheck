import { describe, expect, it } from "vitest";
import { buildTableEventsPath } from "../components/table-event-recorder";

describe("table event recorder", () => {
  it("開催参加画面だけtable-events resourceへ接続する", () => {
    expect(buildTableEventsPath("/g/river-check/games/game-1")).toBe(
      "/g/river-check/games/game-1/table-events",
    );
    expect(buildTableEventsPath("/g/river-check/games/game-1/")).toBe(
      "/g/river-check/games/game-1/table-events",
    );
    expect(buildTableEventsPath("/g/river-check/games/game-1/admin")).toBeNull();
    expect(buildTableEventsPath("/g/river-check")).toBeNull();
  });
});
