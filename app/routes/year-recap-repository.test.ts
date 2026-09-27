import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({ queryDatabase: vi.fn() }));

vi.mock("@server/db/client.server", () => ({
  queryDatabase: mocked.queryDatabase,
}));

import {
  findYearRecapStoryStats,
  listYearRecapAchievements,
  listYearRecapResults,
} from "@server/repositories/year-recap-repository.server";

describe("year recap repository", () => {
  beforeEach(() => vi.resetAllMocks());

  it("日本時間の年範囲にある確定結果をBB換算して取得する", async () => {
    mocked.queryDatabase.mockResolvedValue({
      rows: [{
        game_id: "game-1",
        game_title: "9月ポーカー会",
        played_at: new Date("2026-09-20T10:00:00.000Z"),
        group_player_id: "player-1",
        display_name: "かずと",
        avatar_uploaded_at: null,
        rank: 1,
        total_rebuy_count: 2,
        net_bb: "125.5",
      }],
    });

    await expect(
      listYearRecapResults(
        "group-1",
        "2025-12-31T15:00:00.000Z",
        "2026-12-31T15:00:00.000Z",
      ),
    ).resolves.toMatchObject([{ netBb: 125.5, totalRebuyCount: 2 }]);

    const [sql, params] = mocked.queryDatabase.mock.calls[0] ?? [];
    expect(String(sql)).toContain("game.status = 'finalized'");
    expect(String(sql)).toContain("game.big_blind_chips::NUMERIC");
    expect(params).toEqual([
      "group-1",
      "2025-12-31T15:00:00.000Z",
      "2026-12-31T15:00:00.000Z",
    ]);
  });

  it("TABLE STORIESは投稿を重複せず集計する", async () => {
    mocked.queryDatabase.mockResolvedValue({
      rows: [{ posts_created: 2, reactions_received: 5, reacted_post_count: 3 }],
    });

    await expect(
      findYearRecapStoryStats("group-1", "player-1", "start", "end"),
    ).resolves.toEqual({
      postsCreated: 2,
      reactionsReceived: 5,
      reactedPostCount: 3,
    });
    expect(String(mocked.queryDatabase.mock.calls[0]?.[0])).toContain(
      "COUNT(DISTINCT year_post.id)",
    );
    expect(String(mocked.queryDatabase.mock.calls[0]?.[0])).toContain(
      "COUNT(DISTINCT reaction.game_story_post_id)",
    );
  });

  it("年内に獲得した称号だけを返す", async () => {
    mocked.queryDatabase.mockResolvedValue({
      rows: [{
        id: "achievement-1",
        name: "初優勝",
        icon_key: "trophy",
        unlocked_at: new Date("2026-09-20T10:00:00.000Z"),
      }],
    });

    await expect(
      listYearRecapAchievements("group-1", "player-1", "start", "end"),
    ).resolves.toEqual([{
      id: "achievement-1",
      name: "初優勝",
      iconKey: "trophy",
      unlockedAt: "2026-09-20T10:00:00.000Z",
    }]);
  });
});
