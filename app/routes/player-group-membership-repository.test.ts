import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  queryDatabase: vi.fn(),
}));

vi.mock("@server/db/client.server", () => ({
  queryDatabase: mocked.queryDatabase,
}));

import {
  attachExistingPlayerToGroup,
  listReusablePlayersForGroup,
} from "@server/repositories/player-repository.server";

describe("player group membership repository", () => {
  beforeEach(() => vi.resetAllMocks());

  it("現在のグループに未所属の既存プロフィールを候補として返す", async () => {
    mocked.queryDatabase.mockResolvedValue({
      rows: [
        {
          player_id: "player-1",
          display_name: "Alice",
          avatar_uploaded_at: null,
          has_profile_access: true,
          group_names: ["いつものポーカー会"],
          source_group_code: "river-check",
          source_group_player_id: "group-player-1",
        },
      ],
    });

    await expect(listReusablePlayersForGroup("group-2")).resolves.toMatchObject([
      {
        playerId: "player-1",
        displayName: "Alice",
        groupNames: ["いつものポーカー会"],
      },
    ]);

    const sql = String(mocked.queryDatabase.mock.calls[0]?.[0]);
    expect(sql).toContain("NOT EXISTS");
    expect(sql).toContain("target_membership.group_id = $1");
    expect(mocked.queryDatabase).toHaveBeenCalledWith(expect.any(String), ["group-2"]);
  });

  it("同じplayersレコードをgroup_playersへ追加する", async () => {
    mocked.queryDatabase.mockResolvedValue({ rows: [{ id: "group-player-2" }] });

    await expect(
      attachExistingPlayerToGroup("group-2", "player-1"),
    ).resolves.toBe("group-player-2");

    const sql = String(mocked.queryDatabase.mock.calls[0]?.[0]);
    expect(sql).toContain("INSERT INTO group_players (group_id, player_id)");
    expect(sql).toContain("FROM players AS player");
    expect(mocked.queryDatabase).toHaveBeenCalledWith(expect.any(String), [
      "group-2",
      "player-1",
    ]);
  });
});
