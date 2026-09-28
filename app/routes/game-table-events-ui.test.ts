import { describe, expect, it } from "vitest";
import {
  buildTableEventsPath,
  TABLE_EVENT_RECORDER_OPEN_EVENT,
} from "../components/table-event-recorder";

describe("table event recorder", () => {
  it("開催参加画面だけからtable-events resourceへ接続する", () => {
    expect(buildTableEventsPath("/g/river-check/games/game-1")).toBe(
      "/g/river-check/games/game-1/table-events",
    );
    expect(buildTableEventsPath("/g/river-check/games/game-1/")).toBe(
      "/g/river-check/games/game-1/table-events",
    );
    expect(buildTableEventsPath("/g/river-check/games/game-1/admin")).toBeNull();
    expect(buildTableEventsPath("/g/river-check/games/game-1/admin/edit")).toBeNull();
    expect(buildTableEventsPath("/g/river-check/games/game-1/table-events")).toBeNull();
    expect(TABLE_EVENT_RECORDER_OPEN_EVENT).toBe(
      "rivercheck:open-table-event-recorder",
    );
  });
});
