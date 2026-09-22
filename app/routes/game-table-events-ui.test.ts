import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildTableEventsPath,
  isParticipantTableEventsPath,
  TABLE_EVENT_RECORDER_OPEN_EVENT,
} from "../components/table-event-recorder";

describe("table event recorder", () => {
  const adminSource = readFileSync("app/routes/game-admin.tsx", "utf8");

  it("開催参加画面と管理画面から同じtable-events resourceへ接続する", () => {
    expect(buildTableEventsPath("/g/river-check/games/game-1")).toBe(
      "/g/river-check/games/game-1/table-events",
    );
    expect(buildTableEventsPath("/g/river-check/games/game-1/")).toBe(
      "/g/river-check/games/game-1/table-events",
    );
    expect(buildTableEventsPath("/g/river-check/games/game-1/admin")).toBe(
      "/g/river-check/games/game-1/table-events",
    );
    expect(buildTableEventsPath("/g/river-check/games/game-1/admin/edit")).toBeNull();
    expect(buildTableEventsPath("/g/river-check/games/game-1/table-events")).toBeNull();
  });

  it("参加者画面の固定入口と開催管理の見出しから共通レコーダーを開く", () => {
    expect(TABLE_EVENT_RECORDER_OPEN_EVENT).toBe(
      "rivercheck:open-table-event-recorder",
    );
    expect(isParticipantTableEventsPath("/g/river-check/games/game-1")).toBe(true);
    expect(isParticipantTableEventsPath("/g/river-check/games/game-1/")).toBe(true);
    expect(isParticipantTableEventsPath("/g/river-check/games/game-1/admin")).toBe(false);
    expect(isParticipantTableEventsPath("/g/river-check/games/game-1/admin/edit")).toBe(false);
    expect(adminSource).toContain("admin-table-event-button");
    expect(adminSource).toContain("openTableEventRecorder");
  });
});
