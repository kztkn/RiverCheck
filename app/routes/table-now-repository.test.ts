import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const source = readFileSync("server/repositories/participant-repository.server.ts", "utf8");
describe("TABLE NOW repository", () => {
  it("counts only active events on open games", () => {
    expect(source).toContain("getOpenGameTableEventCounts");
    expect(source).toContain("game.status = 'open'");
    expect(source).toContain("event.canceled_at IS NULL");
    expect(source).toContain("event.event_type = 'all_in'");
    expect(source).toContain("event.event_type = 'bomb_pot'");
    expect(source).toContain("event.event_type = 'seven_deuce'");
  });
});
