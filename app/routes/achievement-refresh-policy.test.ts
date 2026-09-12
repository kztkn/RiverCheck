import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("achievement refresh policy", () => {
  it("keeps finalization authoritative and repairs only dirty collections", () => {
    const finalization = readFileSync(
      "server/services/finalization-service.server.ts",
      "utf8",
    );
    const service = readFileSync(
      "server/services/achievement-service.server.ts",
      "utf8",
    );
    const migration = readFileSync(
      "migrations/0030_track_achievement_refresh.sql",
      "utf8",
    );

    expect(finalization).toContain("await refreshAchievementsBestEffort");
    expect(finalization).not.toContain(
      'scheduleAchievementRefresh(group.id, finalized.achievementPlayerIds',
    );
    expect(service).toContain("if (collection.needsRefresh)");
    expect(service).toContain('reason: "collection-repair"');
    expect(service).toContain('console.info("Achievement refresh succeeded"');
    expect(migration).toContain(
      "achievements_dirty BOOLEAN NOT NULL DEFAULT FALSE",
    );
    expect(migration).toContain("game.status = 'finalized'");
  });

  it("logs actionable database metadata when an achievement refresh fails", () => {
    const service = readFileSync(
      "server/services/achievement-service.server.ts",
      "utf8",
    );

    expect(service).toContain("errorMessage:");
    expect(service).toContain("errorCode:");
    expect(service).toContain("constraint:");
    expect(service).toContain("...buildAchievementErrorLog(error)");
    expect(service).toContain('console.error("Achievement refresh failed"');
  });
});
