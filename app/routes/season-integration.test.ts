import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const state = vi.hoisted(() => ({ db: null as PGlite | null }));
vi.mock("@server/db/client.server", () => ({
  queryDatabase: (sql: string, values: unknown[] = []) =>
    state.db!.query(sql, values),
  withTransaction: (work: (tx: unknown) => Promise<unknown>) =>
    state.db!.transaction((tx) =>
      work({
        query: (sql: string, values: unknown[] = []) => tx.query(sql, values),
      }),
    ),
}));
import { seasonFor } from "@domain/season/season";
import {
  previewSeason,
  readSeason,
} from "@server/repositories/season-repository.server";
import {
  finalizeSeason,
  previewVersion,
  getSeasonOverview,
} from "@server/services/season-service.server";
import { listPlayerStatsRankingSnapshots } from "@server/repositories/player-stats-repository.server";
const auth = vi.hoisted(() => ({ allowed: true }));
vi.mock("@server/services/organizer-auth.server", () => ({
  isOrganizerAuthenticated: async () => auth.allowed,
}));
vi.mock("@server/services/achievement-service.server", () => ({
  getPlayerAchievementCollection: vi.fn(),
}));

const group = crypto.randomUUID();
const otherGroup = crypto.randomUUID();
const alice = crypto.randomUUID();
const bob = crypto.randomUUID();
const outsider = crypto.randomUUID();
const db = () => state.db!;
const season = seasonFor(2026);
const request = new Request("https://example.com/g/test/stats", {
  method: "POST",
});
const now = new Date("2026-12-20T10:00:00Z");
const read = () => previewSeason(group, season);
async function finalize(key = "2026", at = now) {
  const p = await previewSeason(
    group,
    key === "2026" ? season : seasonFor(2027),
  );
  return finalizeSeason(request, "test", key, await previewVersion(p), at);
}

async function addGame(
  playedAt: string,
  status = "finalized",
  groupId = group,
  players = [alice, bob],
) {
  const id = crypto.randomUUID();
  await db().query(
    `INSERT INTO games (id, group_id, title, played_at, status, finalized_at, initial_chips, rebuy_chips, venue_cost, rounding_unit, first_place_cost, second_place_cost, third_place_cost)
    VALUES ($1, $2, 'test', $3, $4, CASE WHEN $4 = 'finalized' THEN NOW() END, 20000, 20000, 0, 100, 0, 0, 0)`,
    [id, groupId, playedAt, status],
  );
  for (const [index, playerId] of players.entries()) {
    await db().query(
      "INSERT INTO game_participants (game_id, group_player_id) VALUES ($1, $2)",
      [id, playerId],
    );
    await db().query(
      `INSERT INTO game_results (game_id, group_player_id, remaining_chips, settlement_rebuy_count, total_rebuy_count, score, rank, cost_share)
      VALUES ($1, $2, $3, 0, 0, $3, $4, 0)`,
      [id, playerId, index === 0 ? 24000 : 16000, index + 1],
    );
  }
  return id;
}

describe("年間まとめ（実際のPostgreSQLで集計・更新・グループ分離を検証）", () => {
  beforeAll(async () => {
    state.db = new PGlite();
    const directory = resolve("migrations");
    for (const name of (await readdir(directory))
      .filter((name) => name.endsWith(".sql"))
      .sort()) {
      await db().exec(
        (await readFile(resolve(directory, name), "utf8")).replace(
          "CREATE EXTENSION IF NOT EXISTS pgcrypto;",
          "",
        ),
      );
    }
  }, 30_000);
  afterAll(async () => {
    await state.db?.close();
  });
  beforeEach(async () => {
    auth.allowed = true;
    await db().exec("TRUNCATE groups, players CASCADE");
    await db().exec("DELETE FROM achievements WHERE category='season'");
    await db().query(
      "INSERT INTO groups (id, name, public_code) VALUES ($1, 'test', 'test'), ($2, 'other', 'other')",
      [group, otherGroup],
    );
    for (const [id, name, groupId] of [
      [alice, "Alice", group],
      [bob, "Bob", group],
      [outsider, "Other", otherGroup],
    ]) {
      await db().query(
        "INSERT INTO players (id, display_name) VALUES ($1, $2)",
        [id, name],
      );
      await db().query(
        "INSERT INTO group_players (id, group_id, player_id) VALUES ($1, $2, $1)",
        [id, groupId],
      );
    }
  });

  it("累計BBが同じ全員に1位称号、次の人に3位称号を付与する", async () => {
    const third = crypto.randomUUID();
    await db().query(
      "INSERT INTO players (id,display_name) VALUES ($1,'Third')",
      [third],
    );
    await db().query(
      "INSERT INTO group_players (id,player_id,group_id) VALUES ($1,$1,$2)",
      [third, group],
    );
    const game = await addGame("2026-12-01T00:00:00Z", "finalized", group, [
      alice,
      bob,
      third,
    ]);
    await db().query(
      "UPDATE game_results SET score=24000 WHERE game_id=$1 AND group_player_id=$2",
      [game, bob],
    );
    expect(await finalize()).toMatchObject({ ok: true });
    expect(
      (await readSeason(group, season))?.ranking.map((p) => p.rank),
    ).toEqual([1, 1, 3]);
    const titles = await db().query<{ code: string }>(
      "SELECT a.code FROM player_achievements p JOIN achievements a ON a.id=p.achievement_id",
    );
    expect(titles.rows.filter((r) => r.code.endsWith("rank-1"))).toHaveLength(
      2,
    );
    expect(titles.rows.filter((r) => r.code.endsWith("rank-3"))).toHaveLength(
      1,
    );
    expect(titles.rows).toHaveLength(6);
  });
  it("migration未適用時も通算を閲覧できる", async () => {
    await addGame("2026-12-01T00:00:00Z");
    await db().exec(
      "ALTER TABLE ranking_seasons RENAME TO unavailable_seasons",
    );
    try {
      const result = await getSeasonOverview(
        new Request("https://example.com/g/test/stats"),
        "test",
        "total",
      );
      expect(result.unavailable).toBe(true);
      expect(result.ranking).toHaveLength(2);
    } finally {
      await db().exec(
        "ALTER TABLE unavailable_seasons RENAME TO ranking_seasons",
      );
    }
  });
  it("初回日・JST年境界・グループ・確定状態を絞り、異なるBBで集計する", async () => {
    await addGame("2026-06-18T14:59:59Z");
    await addGame("2026-06-18T15:00:00Z");
    const second = await addGame("2026-12-31T14:59:59Z", "finalized", group, [
      bob,
      alice,
    ]);
    await db().query(
      "UPDATE games SET small_blind_chips=50,big_blind_chips=100,big_blind_ante_chips=100,initial_stack_bb=200 WHERE id=$1",
      [second],
    );
    await addGame("2026-12-31T15:00:00Z");
    await addGame("2026-12-20T10:00:00Z", "open");
    await addGame("2026-12-20T10:00:00Z", "finalized", otherGroup, [outsider]);
    const p = await read();
    expect(p.pendingCount).toBe(1);
    expect(
      p.ranking.map((r) => [r.displayName, r.gamesPlayed, r.totalNetBb]),
    ).toEqual([
      ["Bob", 2, 20],
      ["Alice", 2, -20],
    ]);
    expect(
      (await previewSeason(group, seasonFor(2027))).ranking[0].gamesPlayed,
    ).toBe(1);
  });
  it("ADMINと終了月を検証し、古いプレビュー・空のシーズンを拒否する", async () => {
    auth.allowed = false;
    await expect(finalize()).rejects.toMatchObject({ status: 403 });
    auth.allowed = true;
    await expect(
      finalize("2026", new Date("2026-11-30T14:59:59Z")),
    ).rejects.toMatchObject({ status: 400 });
    expect((await finalize()).ok).toBe(false);
    await addGame("2026-12-01T00:00:00Z");
    expect(
      await finalizeSeason(request, "test", "2026", "old", now),
    ).toMatchObject({ ok: false });
    expect(await readSeason(group, season)).toBeNull();
  });
  it("順位・称号を原子的に保存し、二重確定・訂正・追加開催に影響されず一般参加者にも公開する", async () => {
    const game = await addGame("2026-12-01T00:00:00Z");
    expect(await finalize()).toMatchObject({ ok: true });
    const saved = await readSeason(group, season);
    expect(saved?.ranking[0].displayName).toBe("Alice");
    expect(
      (await db().query("SELECT * FROM player_achievements")).rows,
    ).toHaveLength(4);
    expect(await finalize()).toMatchObject({ ok: false });
    await db().query(
      "UPDATE game_results SET score=10000 WHERE game_id=$1 AND group_player_id=$2",
      [game, alice],
    );
    await addGame("2026-12-21T00:00:00Z", "finalized", group, [bob, alice]);
    auth.allowed = false;
    const visible = await getSeasonOverview(
      new Request("https://example.com/g/test/stats?season=2026"),
      "test",
      "total",
    );
    expect(visible.finalizedAt).not.toBeNull();
    expect(visible.ranking).toEqual(saved?.ranking);
    expect(visible.canFinalize).toBe(false);
    expect(
      (await listPlayerStatsRankingSnapshots(group)).current.find(
        (p) => p.groupPlayerId === alice,
      )?.totalNetBb,
    ).not.toBe(saved?.ranking[0].totalNetBb);
    auth.allowed = true;
    await addGame("2027-01-01T00:00:00Z");
    expect(
      await finalize("2027-s1", new Date("2027-06-01T00:00:00+09:00")),
    ).toMatchObject({ ok: true });
    expect(
      (await db().query("SELECT * FROM player_achievements")).rows,
    ).toHaveLength(8);
  });
  it("称号付与が失敗した場合はスナップショットと称号マスタもrollbackする", async () => {
    await addGame("2026-12-01T00:00:00Z");
    await db().exec(
      "ALTER TABLE player_achievements ADD CONSTRAINT fail_season CHECK (metadata->>'season' IS NULL)",
    );
    try {
      await expect(finalize()).rejects.toThrow();
      expect(await readSeason(group, season)).toBeNull();
      expect(
        (await db().query("SELECT * FROM achievements WHERE category='season'"))
          .rows,
      ).toHaveLength(0);
    } finally {
      await db().exec(
        "ALTER TABLE player_achievements DROP CONSTRAINT fail_season",
      );
    }
  });
});
