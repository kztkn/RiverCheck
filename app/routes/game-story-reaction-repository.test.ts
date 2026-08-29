import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  queryDatabase: vi.fn(),
  withTransaction: vi.fn(),
}));

vi.mock("@server/db/client.server", () => ({
  queryDatabase: mocked.queryDatabase,
  withTransaction: mocked.withTransaction,
}));

import {
  listGameStoryReactionSummaries,
  setGameStoryReactionState,
} from "@server/repositories/game-story-reaction-repository.server";

describe("game story reaction repository", () => {
  beforeEach(() => vi.resetAllMocks());

  it("確定済みで削除されていない投稿の件数と自分の選択だけを返す", async () => {
    mocked.queryDatabase.mockResolvedValue({
      rows: [
        {
          post_id: "post-1",
          reaction_type: "fire",
          reaction_count: 3,
          reacted_by_current_player: true,
        },
      ],
    });
    await expect(
      listGameStoryReactionSummaries("group-1", "game-1", null),
    ).resolves.toEqual([
      { postId: "post-1", type: "fire", count: 3, reactedByCurrentPlayer: true },
    ]);
    const sql = String(mocked.queryDatabase.mock.calls[0]?.[0]);
    expect(sql).toContain("game.status = 'finalized'");
    expect(sql).toContain("post.deleted_at IS NULL");
    expect(sql).toContain("BOOL_OR");
  });

  it("active=trueを冪等INSERTし、保存後の件数を返す", async () => {
    const transaction = { query: vi.fn() };
    mocked.withTransaction.mockImplementation(async (callback) => callback(transaction));
    transaction.query
      .mockResolvedValueOnce({ rows: [{ id: "post-1" }] })
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ reaction_count: 4 }] });

    await expect(
      setGameStoryReactionState(
        "group-1",
        "game-1",
        "post-1",
        "player-1",
        "laugh",
        true,
      ),
    ).resolves.toEqual({ active: true, count: 4 });
    expect(String(transaction.query.mock.calls[1]?.[0])).toContain(
      "ON CONFLICT (game_story_post_id, group_player_id, reaction_type)",
    );
    expect(String(transaction.query.mock.calls[0]?.[0])).toContain(
      "actor.is_active = TRUE",
    );
  });
});
