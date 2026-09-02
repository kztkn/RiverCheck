import { describe, expect, it, vi } from "vitest";

vi.mock("@server/db/client.server", () => ({
  queryDatabase: vi.fn(),
}));
import type { DatabaseTransaction } from "@server/db/client.server";
import {
  deleteFinalResultsForReopen,
  getFinalizationReopenBlockers,
  markGameOpenAfterFinalization,
} from "@server/repositories/finalization-repository.server";

function tx(query: ReturnType<typeof vi.fn>): DatabaseTransaction {
  return { query } as unknown as DatabaseTransaction;
}

describe("finalization reopen repository", () => {
  it("checks revisions, receipts and stories for the target game", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{
      has_result_revisions: true, has_cost_share_receipts: false, has_story_posts: true,
    }] });
    await expect(getFinalizationReopenBlockers(tx(query), "game-1")).resolves.toEqual({
      hasResultRevisions: true, hasCostShareReceipts: false, hasStoryPosts: true,
    });
    const sql = String(query.mock.calls[0]?.[0]);
    expect(sql).toContain("game_result_revisions");
    expect(sql).toContain("game_cost_share_receipts");
    expect(sql).toContain("game_story_posts");
    expect(sql).toContain("game_participants");
  });

  it("deletes results and only reopens a finalized game", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rowCount: 4, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    await deleteFinalResultsForReopen(tx(query), "game-1");
    await expect(markGameOpenAfterFinalization(tx(query), "group-1", "game-1")).resolves.toBe(true);
    expect(String(query.mock.calls[0]?.[0])).toContain("DELETE FROM game_results");
    const updateSql = String(query.mock.calls[1]?.[0]);
    expect(updateSql).toContain("status = 'open'");
    expect(updateSql).toContain("finalized_at = NULL");
    expect(updateSql).toContain("status = 'finalized'");
  });
});
