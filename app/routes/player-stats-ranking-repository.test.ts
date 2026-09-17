import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  queryDatabase: vi.fn(),
}));

vi.mock("@server/db/client.server", () => ({
  queryDatabase: mocked.queryDatabase,
}));

import { listPlayerStatsRankingSnapshots } from "@server/repositories/player-stats-repository.server";

describe("player stats ranking repository", () => {
  beforeEach(() => vi.resetAllMocks());

  it("確定済み開催へ1回以上参加したプレイヤーだけをランキング対象にする", async () => {
    mocked.queryDatabase.mockResolvedValue({
      rows: [
        {
          comparison_scope: "current",
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

    await expect(listPlayerStatsRankingSnapshots("group-1")).resolves.toMatchObject({
      current: [{ groupPlayerId: "player-1", gamesPlayed: 1 }],
      previous: [],
    });

    const sql = String(mocked.queryDatabase.mock.calls[0]?.[0]);
    expect(sql).toContain("INNER JOIN finalized_results AS finalized_result");
    expect(sql).not.toContain("LEFT JOIN finalized_results AS finalized_result");
    expect(mocked.queryDatabase).toHaveBeenCalledWith(expect.any(String), ["group-1"]);
    expect(mocked.queryDatabase).toHaveBeenCalledTimes(1);
    expect(sql).toContain("WHERE group_id = $1 AND status = 'finalized'");
    expect(sql).toContain("WHERE group_player.group_id = $1");
    expect(sql).not.toContain("game_result_revisions");
  });

  it("最新開催を除外した集合内で直近3参加と開催人数を計算する", async () => {
    mocked.queryDatabase.mockResolvedValue({ rows: [] });
    await expect(listPlayerStatsRankingSnapshots("group-1")).resolves.toEqual({ current: [], previous: [] });
    const sql = String(mocked.queryDatabase.mock.calls[0]?.[0]);
    expect(sql).toContain("ORDER BY played_at DESC, finalized_at DESC, id DESC");
    expect(sql).toContain("WHERE comparison.scope = 'current' OR game.game_number > 1");
    expect(sql).toContain("PARTITION BY comparison.scope, game_result.group_player_id");
    expect(sql).toContain("PARTITION BY comparison.scope, game_result.game_id");
    expect(sql).toContain("WHERE finalized_result.recent_number <= 3");
    expect(sql).toContain("GROUP BY finalized_result.comparison_scope");
  });

  it("現在と前回の集計を分離し、訂正・取消後は次の取得結果へ追従する", async () => {
    const base = {
      group_player_id: "player-1", display_name: "Alice", games_played: 3,
      wins: 1, top_three_finishes: 2, total_net_bb: "25", average_net_bb: "25",
      max_win_bb: "25", max_loss_bb: "0", recent_average_net_bb: "25",
      recent_game_count: 3, average_rank_rate: "12.5", invalid_initial_chips_count: 0,
      avatar_uploaded_at: null,
    };
    mocked.queryDatabase
      .mockResolvedValueOnce({ rows: [
        { ...base, comparison_scope: "current", total_net_bb: "100", recent_average_net_bb: "60", games_played: 4 },
        { ...base, comparison_scope: "previous" },
      ] })
      .mockResolvedValueOnce({ rows: [
        { ...base, comparison_scope: "current", total_net_bb: "-50" },
        { ...base, comparison_scope: "previous" },
      ] })
      .mockResolvedValueOnce({ rows: [{ ...base, comparison_scope: "current" }] });
    const first = await listPlayerStatsRankingSnapshots("group-1");
    expect(first.current[0]).toMatchObject({ totalNetBb: 100, recentAverageNetBb: 60, gamesPlayed: 4 });
    expect(first.previous[0]).toMatchObject({ totalNetBb: 25, recentAverageNetBb: 25, gamesPlayed: 3 });
    expect((await listPlayerStatsRankingSnapshots("group-1")).current[0].totalNetBb).toBe(-50);
    expect((await listPlayerStatsRankingSnapshots("group-1")).previous).toEqual([]);
    expect(mocked.queryDatabase).toHaveBeenCalledTimes(3);
  });

  it("不正な初期チップを黙って集計しない", async () => {
    mocked.queryDatabase.mockResolvedValue({ rows: [{ comparison_scope: "current", invalid_initial_chips_count: 1 }] });
    await expect(listPlayerStatsRankingSnapshots("group-1")).rejects.toThrow();
  });
});
