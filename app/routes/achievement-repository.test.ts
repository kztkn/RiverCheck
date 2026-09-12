import { describe, expect, it, vi } from "vitest";

vi.mock("@server/db/client.server", () => ({
  queryDatabase: vi.fn(),
}));

import {
  clearAchievementRefreshNeeded,
  insertAchievementUnlocks,
  listAchievementHistoryGames,
  listAchievementReactionSummaries,
  lockAchievementRefreshTargets,
  markAchievementRefreshNeeded,
} from "@server/repositories/achievement-repository.server";
import type { DatabaseTransaction } from "@server/db/client.server";

function transactionWith(query: ReturnType<typeof vi.fn>): DatabaseTransaction {
  return { query } as unknown as DatabaseTransaction;
}

describe("achievement repository", () => {
  it("inserts evaluated unlocks in one append-only query", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    await insertAchievementUnlocks(transactionWith(query), "group-1", [
      {
        groupPlayerId: "00000000-0000-4000-8000-000000000001",
        unlock: {
          code: "seven-deuce-first",
          sourceGameId: "00000000-0000-4000-8000-000000000010",
        },
      },
      {
        groupPlayerId: "00000000-0000-4000-8000-000000000001",
        unlock: {
          code: "story-first",
          sourceGameId: "00000000-0000-4000-8000-000000000010",
        },
      },
    ]);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0]?.[0]).toContain("jsonb_to_recordset");
    expect(query.mock.calls[0]?.[0]).toContain("ON CONFLICT (group_player_id, achievement_id) DO NOTHING");
    expect(query.mock.calls[0]?.[0]).not.toContain("DELETE FROM player_achievements");
  });

  it("marks, locks, and clears achievement refresh state", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ id: "player-1" }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });
    const transaction = transactionWith(query);

    await markAchievementRefreshNeeded(transaction, "group-1", ["player-1"]);
    await expect(lockAchievementRefreshTargets(
      transaction,
      "group-1",
      ["player-1"],
    )).resolves.toEqual(["player-1"]);
    await clearAchievementRefreshNeeded(transaction, "group-1", ["player-1"]);

    expect(String(query.mock.calls[0]?.[0])).toContain("achievements_dirty = TRUE");
    expect(String(query.mock.calls[1]?.[0])).toContain("FOR UPDATE");
    expect(String(query.mock.calls[2]?.[0])).toContain("achievements_dirty = FALSE");
  });

  it("loads finalized result, table-event, and story facts in one history query", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{
        group_player_id: "player-1",
        game_id: "game-1",
        rank: 2,
        participant_count: "5",
        net_bb: "25",
        initial_chips: "20000",
        total_rebuy_count: null,
        tracked_outstanding_rebuy_count: null,
        settlement_rebuy_count: 1,
        seven_deuce_count: 2,
        all_in_win_count: 1,
        all_in_loss_count: 3,
        story_post_count: 1,
      }],
    });
    await expect(listAchievementHistoryGames(
      transactionWith(query),
      "group-1",
      ["player-1"],
    )).resolves.toEqual([{
      groupPlayerId: "player-1",
      gameId: "game-1",
      rank: 2,
      participantCount: 5,
      netBb: 25,
      totalRebuyCount: 1,
      outstandingRebuyCount: null,
      settlementRebuyCount: 1,
      sevenDeuceCount: 2,
      allInWinCount: 1,
      allInLossCount: 3,
      storyPostCount: 1,
    }]);
    const sql = String(query.mock.calls[0]?.[0]);
    expect(sql).toContain("seven_deuce_metrics");
    expect(sql).toContain("all_in_metrics");
    expect(sql).toContain("story_metrics");
    expect(sql).toContain("event.canceled_at IS NULL");
  });

  it("counts reactions by distinct story post and keeps the fifth source game", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{
        group_player_id: "player-1",
        reacted_story_post_count: 5,
        fifth_reacted_story_game_id: "game-5",
      }],
    });
    await expect(listAchievementReactionSummaries(
      transactionWith(query),
      "group-1",
      ["player-1"],
    )).resolves.toEqual([{
      groupPlayerId: "player-1",
      reactedStoryPostCount: 5,
      fifthReactedStoryGameId: "game-5",
    }]);
    expect(String(query.mock.calls[0]?.[0])).toContain("reaction_number = 5");
  });
});
