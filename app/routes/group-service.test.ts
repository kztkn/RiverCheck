import { beforeEach, describe, expect, it, vi } from "vitest";
import { validateGroupIdentity } from "@domain/group/validate-group";

const mocked = vi.hoisted(() => ({
  findGroupByPublicCode: vi.fn(),
  listGamesForGroupByPublicCode: vi.fn(),
}));

vi.mock("@server/repositories/game-repository.server", () => ({
  listGamesForGroupByPublicCode: mocked.listGamesForGroupByPublicCode,
}));

vi.mock("@server/repositories/group-repository.server", () => ({
  findGroupByPublicCode: mocked.findGroupByPublicCode,
  insertGroup: vi.fn(),
  listGroups: vi.fn(),
  listGroupsForPlayer: vi.fn(),
  updateGroupName: vi.fn(),
}));

import { getGroupOverview } from "@server/services/group-service.server";

describe("validateGroupIdentity", () => {
  it("グループ名をtrimしURL用コードを小文字へ正規化する", () => {
    expect(
      validateGroupIdentity({
        name: "  ボドゲ会  ",
        publicCode: "BoardGame-2026",
      }),
    ).toEqual({
      ok: true,
      values: {
        name: "ボドゲ会",
        publicCode: "boardgame-2026",
      },
    });
  });

  it("URL用コードに使用できない文字を拒否する", () => {
    const result = validateGroupIdentity({
      name: "ボドゲ会",
      publicCode: "ボドゲ会",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.publicCode).toContain("半角英小文字");
    }
  });
});

const group = {
  id: "group-1",
  lineOpenChatUrl: null,
  name: "River Check",
  payPayLinkRegisteredAt: null,
  payPayRecipientLink: null,
  publicCode: "river-check",
};

describe("group overview service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("グループと開催一覧の取得を同時に開始する", async () => {
    let resolveGroup: (value: typeof group) => void = () => undefined;
    let resolveGames: (value: []) => void = () => undefined;
    mocked.findGroupByPublicCode.mockReturnValue(
      new Promise((resolve) => {
        resolveGroup = resolve;
      }),
    );
    mocked.listGamesForGroupByPublicCode.mockReturnValue(
      new Promise((resolve) => {
        resolveGames = resolve;
      }),
    );

    const overviewPromise = getGroupOverview("river-check");

    expect(mocked.findGroupByPublicCode).toHaveBeenCalledWith("river-check");
    expect(mocked.listGamesForGroupByPublicCode).toHaveBeenCalledWith(
      "river-check",
    );

    resolveGroup(group);
    resolveGames([]);
    await expect(overviewPromise).resolves.toEqual({ group, games: [] });
  });

  it("存在しないグループではnullを返す", async () => {
    mocked.findGroupByPublicCode.mockResolvedValue(null);
    mocked.listGamesForGroupByPublicCode.mockResolvedValue([]);

    await expect(getGroupOverview("missing")).resolves.toBeNull();
  });
});
