import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  getAuthenticatedPlayerIdentity: vi.fn(),
  isOrganizerAuthenticated: vi.fn(),
  listGroups: vi.fn(),
  listGroupsForPlayer: vi.fn(),
}));

vi.mock("@server/repositories/group-repository.server", () => ({
  listGroups: mocked.listGroups,
  listGroupsForPlayer: mocked.listGroupsForPlayer,
}));
vi.mock("@server/services/organizer-auth.server", () => ({
  isOrganizerAuthenticated: mocked.isOrganizerAuthenticated,
}));
vi.mock("@server/services/player-profile-service.server", () => ({
  getAuthenticatedPlayerIdentity: mocked.getAuthenticatedPlayerIdentity,
}));

import { getHomeEntryGroups } from "@server/services/home-entry-service.server";

describe("home entry groups", () => {
  beforeEach(() => vi.resetAllMocks());

  it("一般プレイヤーは本人が所属するグループだけを入口候補にする", async () => {
    mocked.getAuthenticatedPlayerIdentity.mockResolvedValue({
      playerId: "player-1",
      displayName: "Alice",
    });
    mocked.isOrganizerAuthenticated.mockResolvedValue(false);
    mocked.listGroupsForPlayer.mockResolvedValue([
      { id: "group-1", name: "A", publicCode: "group-a" },
    ]);

    const result = await getHomeEntryGroups(new Request("https://example.com/"));

    expect(result.groups).toHaveLength(1);
    expect(mocked.listGroupsForPlayer).toHaveBeenCalledWith("player-1");
    expect(mocked.listGroups).not.toHaveBeenCalled();
  });

  it("未認証ゲストは既定グループへフォールバックしない", async () => {
    mocked.getAuthenticatedPlayerIdentity.mockResolvedValue(null);
    mocked.isOrganizerAuthenticated.mockResolvedValue(false);

    const result = await getHomeEntryGroups(new Request("https://example.com/"));

    expect(result.groups).toEqual([]);
    expect(mocked.listGroupsForPlayer).not.toHaveBeenCalled();
    expect(mocked.listGroups).not.toHaveBeenCalled();
  });
});
