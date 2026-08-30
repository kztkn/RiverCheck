import { describe, expect, it } from "vitest";
import { isPublicGroupEntryPath } from "./public-group-entry";

describe("isPublicGroupEntryPath", () => {
  it("受付用の開催ページと認証入口だけを未所属ユーザーへ公開する", () => {
    expect(
      isPublicGroupEntryPath(
        "/g/river-check/games/22222222-2222-4222-8222-222222222222",
        "river-check",
      ),
    ).toBe(true);
    expect(
      isPublicGroupEntryPath(
        "/g/river-check/organizer-login",
        "river-check",
      ),
    ).toBe(true);
    expect(
      isPublicGroupEntryPath(
        "/g/river-check/profile/claim/token-value",
        "river-check",
      ),
    ).toBe(true);
    expect(
      isPublicGroupEntryPath(
        "/g/river-check/players/player-id/avatar",
        "river-check",
      ),
    ).toBe(true);
  });

  it("グループ内画面や開催管理は公開しない", () => {
    expect(isPublicGroupEntryPath("/g/river-check", "river-check")).toBe(false);
    expect(isPublicGroupEntryPath("/g/river-check/about", "river-check")).toBe(false);
    expect(isPublicGroupEntryPath("/g/river-check/stats", "river-check")).toBe(false);
    expect(
      isPublicGroupEntryPath(
        "/g/river-check/games/22222222-2222-4222-8222-222222222222/admin",
        "river-check",
      ),
    ).toBe(false);
  });
});
