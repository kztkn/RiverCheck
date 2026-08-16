import { describe, expect, it, vi } from "vitest";

vi.mock("@server/db/client.server", () => ({
  queryDatabase: vi.fn(),
}));

import {
  listAchievementHistoryGames,
  synchronizeAchievementUnlocks,
} from "@server/repositories/achievement-repository.server";
import type { DatabaseTransaction } from "@server/db/client.server";

function transactionWith(query: ReturnType<typeof vi.fn>): DatabaseTransaction {
  return { query } as unknown as DatabaseTransaction;
}

describe("achievement repository reconciliation", () => {
  it("clears an invalid equipped achievement and removes invalid managed unlocks", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });

    await synchronizeAchievementUnlocks(
      transactionWith(query),
      "group-1",
      "player-1",
      [],
    );

    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0]?.[0]).toContain(
      "SET equipped_achievement_id = NULL",
    );
    expect(query.mock.calls[1]?.[0]).toContain(
      "DELETE FROM player_achievements",
    );
    expect(query.mock.calls[0]?.[1]).toEqual([
      "group-1",
      "player-1",
      expect.arrayContaining(["first-win", "first-hand", "title-defense"]),
      [],
    ]);
  });

  it("upserts the earliest currently valid source without creating duplicates", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });

    await synchronizeAchievementUnlocks(
      transactionWith(query),
      "group-1",
      "player-1",
      [{ code: "phoenix", sourceGameId: "game-2" }],
    );

    expect(query).toHaveBeenCalledTimes(3);
    expect(query.mock.calls[2]?.[0]).toContain(
      "ON CONFLICT (group_player_id, achievement_id) DO UPDATE",
    );
    expect(query.mock.calls[2]?.[0]).toContain(
      "source_game_id = EXCLUDED.source_game_id",
    );
    expect(query.mock.calls[2]?.[1]).toEqual([
      "group-1",
      "player-1",
      "phoenix",
      "game-2",
    ]);
  });

  it("maps finalized history with participant counts and legacy rebuy fallback", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          group_player_id: "player-1",
          game_id: "game-1",
          rank: 2,
          participant_count: "5",
          net_bb: "25",
          initial_chips: "20000",
          total_rebuy_count: null,
          tracked_outstanding_rebuy_count: null,
          settlement_rebuy_count: 1,
        },
      ],
    });

    await expect(
      listAchievementHistoryGames(
        transactionWith(query),
        "group-1",
        ["player-1"],
      ),
    ).resolves.toEqual([
      {
        groupPlayerId: "player-1",
        gameId: "game-1",
        rank: 2,
        participantCount: 5,
        netBb: 25,
        totalRebuyCount: 1,
        outstandingRebuyCount: null,
        settlementRebuyCount: 1,
      },
    ]);
    const historySql = String(query.mock.calls[0]?.[0]);
    expect(historySql).toContain("WITH finalized_results AS");
    expect(historySql).toContain("game.status = 'finalized'");
    expect(historySql.indexOf("COUNT(*) OVER")).toBeLessThan(
      historySql.indexOf("group_player_id = ANY"),
    );
  });
});
