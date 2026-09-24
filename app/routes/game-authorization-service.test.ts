import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  getAuthenticatedPlayerIdentity: vi.fn(),
  hasGroupEventCreatorPermission: vi.fn(),
  isOrganizerAuthenticated: vi.fn(),
}));

vi.mock("@server/services/organizer-auth.server", () => ({
  isOrganizerAuthenticated: mocked.isOrganizerAuthenticated,
}));
vi.mock("@server/services/player-profile-service.server", () => ({
  getAuthenticatedPlayerIdentity: mocked.getAuthenticatedPlayerIdentity,
}));
vi.mock("@server/repositories/game-authorization-repository.server", () => ({
  hasGroupEventCreatorPermission: mocked.hasGroupEventCreatorPermission,
}));

import {
  getGameManagementActor,
  requireGroupEventCreator,
} from "@server/services/game-authorization-service.server";

const request = new Request("https://example.com/g/river-check/manage");
const group = { id: "group-1" } as Parameters<typeof requireGroupEventCreator>[1];

describe("game authorization service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocked.isOrganizerAuthenticated.mockResolvedValue(false);
    mocked.getAuthenticatedPlayerIdentity.mockResolvedValue(null);
    mocked.hasGroupEventCreatorPermission.mockResolvedValue(false);
  });

  it("ADMINはユーザーIDがなくても全開催を管理できる", async () => {
    mocked.isOrganizerAuthenticated.mockResolvedValue(true);
    await expect(
      getGameManagementActor(request, { createdByPlayerId: null }),
    ).resolves.toEqual({ kind: "admin", playerId: null });
  });

  it("指定グループの権限ユーザーだけが開催を作成できる", async () => {
    mocked.getAuthenticatedPlayerIdentity.mockResolvedValue({
      playerId: "player-1",
      displayName: "Alice",
    });
    mocked.hasGroupEventCreatorPermission.mockResolvedValue(true);

    await expect(requireGroupEventCreator(request, group)).resolves.toEqual({
      kind: "creator",
      playerId: "player-1",
    });
    expect(mocked.hasGroupEventCreatorPermission).toHaveBeenCalledWith(
      "group-1",
      "player-1",
    );
  });

  it("作成者本人だけが一般ユーザーとして開催を管理できる", async () => {
    mocked.getAuthenticatedPlayerIdentity.mockResolvedValue({
      playerId: "player-1",
      displayName: "Alice",
    });

    await expect(
      getGameManagementActor(request, { createdByPlayerId: "player-1" }),
    ).resolves.toEqual({ kind: "creator", playerId: "player-1" });
    await expect(
      getGameManagementActor(request, { createdByPlayerId: "player-2" }),
    ).resolves.toBeNull();
    await expect(
      getGameManagementActor(request, { createdByPlayerId: null }),
    ).resolves.toBeNull();
  });
});
