import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildTableEventsPath,
  TABLE_EVENT_RECORDER_OPEN_EVENT,
} from "../components/table-event-recorder";

describe("table event recorder", () => {
  const participantSource = readFileSync("app/routes/game-participant.tsx", "utf8");
  const adminSource = readFileSync("app/routes/game-admin.tsx", "utf8");
  const recorderSource = readFileSync(
    "app/components/table-event-recorder.tsx",
    "utf8",
  );

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

  it("参加者のクイック操作と開催管理の見出しから共通レコーダーを開く", () => {
    expect(TABLE_EVENT_RECORDER_OPEN_EVENT).toBe(
      "rivercheck:open-table-event-recorder",
    );
    expect(participantSource).toContain("participant-table-event-button");
    expect(participantSource).toContain("openTableEventRecorder");
    expect(adminSource).toContain("admin-table-event-button");
    expect(adminSource).toContain("openTableEventRecorder");
    expect(recorderSource).not.toContain("table-event-fixed-layer");
    expect(recorderSource).not.toContain("table-event-trigger");
  });
});
