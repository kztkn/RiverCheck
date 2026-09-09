import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const component = readFileSync("app/components/table-now.tsx", "utf8");
const participant = readFileSync("app/routes/game-participant.tsx", "utf8");
const top = readFileSync("app/routes/group-top.tsx", "utf8");
const styles = readFileSync("app/styles/table-now.css", "utf8");

describe("LIVE TABLE", () => {
  it("uses LIVE TABLE without the old Japanese subtitle", () => {
    expect(component).toContain(">LIVE TABLE<");
    expect(component).not.toContain("いまの卓");
  });
  it("opens players from LIVE TABLE and hides the duplicate roster trigger", () => {
    expect(participant).toContain("rosterOpenSignal");
    expect(participant).toContain("hideTrigger");
    expect(component).toContain("onPlayersClick");
  });
  it("offers event details and a top mini LIVE TABLE", () => {
    expect(component).toContain("live-table-detail-dialog");
    expect(component).toContain("勝者");
    expect(top).toContain("<LiveTableMini");
    expect(styles).toContain("home-live-table-mini");
  });
});
