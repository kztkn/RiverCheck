import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  queryDatabase: vi.fn(),
}));

vi.mock("@server/db/client.server", () => ({
  queryDatabase: mocked.queryDatabase,
}));

import { listPlayerStatsRanking } from "@server/repositories/player-stats-repository.server";

describe("player stats ranking repository", () => {
  beforeEach(() => vi.resetAllMocks());

  it("確定済み開催へ1回以上参加したプレイヤーだけをランキング対象にする", async () => {
    mocked.queryDatabase.mockResolvedValue({
      rows: [
        {
          leaderboard_rank: "1",
          group_player_id: "player-1",
          display_name: "Alice",
          games_played: 1,
          wins: 1,
          top_three_finishes: 1,
          total_net_bb: "25",
          average_net_bb: "25",
          max_win_bb: "25",
          max_loss_bb: "0",
          recent_average_net_bb: "25",
          recent_game_count: 1,
          average_rank_rate: "12.5",
          invalid_initial_chips_count: 0,
          avatar_uploaded_at: null,
          achievement_id: null,
          achievement_code: null,
          achievement_name: null,
          achievement_description: null,
          achievement_icon_key: null,
          achievement_category: null,
        },
      ],
    });

    await expect(listPlayerStatsRanking("group-1", "total")).resolves.toMatchObject([
      { groupPlayerId: "player-1", gamesPlayed: 1, rank: 1 },
    ]);

    const sql = String(mocked.queryDatabase.mock.calls[0]?.[0]);
    expect(sql).toContain("INNER JOIN finalized_results AS finalized_result");
    expect(sql).not.toContain("LEFT JOIN finalized_results AS finalized_result");
    expect(mocked.queryDatabase).toHaveBeenCalledWith(expect.any(String), ["group-1"]);
  });
});
