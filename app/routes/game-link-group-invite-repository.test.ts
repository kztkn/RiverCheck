import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  queryDatabase: vi.fn(),
  transactionQuery: vi.fn(),
}));

vi.mock("@server/db/client.server", () => ({
  queryDatabase: mocked.queryDatabase,
  withTransaction: vi.fn(async (work) =>
    work({ query: mocked.transactionQuery }),
  ),
}));

import { findPlayerIdentityBySession } from "@server/repositories/player-profile-repository.server";
import { joinExistingPlayerToGroupGame } from "@server/repositories/participant-repository.server";

describe("game link group invite repositories", () => {
  beforeEach(() => vi.resetAllMocks());

  it("プロフィールセッションからgroup未所属でもglobal playerを解決する", async () => {
    mocked.queryDatabase.mockResolvedValue({
      rows: [{ player_id: "player-1", display_name: "Alice" }],
    });

    await expect(findPlayerIdentityBySession("token-hash")).resolves.toEqual({
      playerId: "player-1",
      displayName: "Alice",
    });

    const sql = String(mocked.queryDatabase.mock.calls[0]?.[0]);
    expect(sql).toContain("player_profile_sessions");
    expect(sql).not.toContain("group_players");
  });

  it("open開催をlockして既存playerのgroup所属と参加を同一transactionで作る", async () => {
    mocked.transactionQuery
      .mockResolvedValueOnce({ rows: [{ id: "game-1" }] })
      .mockResolvedValueOnce({ rows: [{ id: "group-player-1" }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });

    await expect(
      joinExistingPlayerToGroupGame(
        "group-1",
        "game-1",
        "player-1",
        "token-hash",
      ),
    ).resolves.toBe("group-player-1");

    expect(String(mocked.transactionQuery.mock.calls[0]?.[0])).toContain(
      "FOR UPDATE",
    );
    expect(String(mocked.transactionQuery.mock.calls[1]?.[0])).toContain(
      "INSERT INTO group_players",
    );
    expect(String(mocked.transactionQuery.mock.calls[2]?.[0])).toContain(
      "INSERT INTO game_participants",
    );
  });
});
