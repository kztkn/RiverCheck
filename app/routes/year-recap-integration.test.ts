import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlayerProfileRecord } from "@server/repositories/player-profile-repository.server";

const state = vi.hoisted(() => ({ db: null as PGlite | null }));
vi.mock("@server/db/client.server", () => ({
  queryDatabase: (sql: string, values: unknown[] = []) => state.db!.query(sql, values),
}));
import { getYearRecap } from "@server/services/year-recap-service.server";
import { findPlayerProfileBySession } from "@server/repositories/player-profile-repository.server";

const group = crypto.randomUUID();
const otherGroup = crypto.randomUUID();
const alice = crypto.randomUUID();
const bob = crypto.randomUUID();
const outsider = crypto.randomUUID();
const profile = { groupPlayerId: alice, displayName: "Alice", avatarUploadedAt: null } as PlayerProfileRecord;
const db = () => state.db!;
const read = () => getYearRecap(group, profile, 2026);

async function addGame(playedAt: string, status = "finalized", groupId = group, players = [alice, bob]) {
  const id = crypto.randomUUID();
  await db().query(`INSERT INTO games (id, group_id, title, played_at, status, finalized_at, initial_chips, rebuy_chips, venue_cost, rounding_unit, first_place_cost, second_place_cost, third_place_cost)
    VALUES ($1, $2, 'test', $3, $4, CASE WHEN $4 = 'finalized' THEN NOW() END, 20000, 20000, 0, 100, 0, 0, 0)`, [id, groupId, playedAt, status]);
  for (const [index, playerId] of players.entries()) {
    await db().query("INSERT INTO game_participants (game_id, group_player_id) VALUES ($1, $2)", [id, playerId]);
    await db().query(`INSERT INTO game_results (game_id, group_player_id, remaining_chips, settlement_rebuy_count, total_rebuy_count, score, rank, cost_share)
      VALUES ($1, $2, $3, 0, 0, $3, $4, 0)`, [id, playerId, index === 0 ? 24000 : 16000, index + 1]);
  }
  return id;
}

async function addPost(gameId: string, playerId: string, deleted = false) {
  const result = await db().query<{ id: string }>(`INSERT INTO game_story_posts (game_participant_id, body, deleted_at, deleted_by_type)
    SELECT id, '思い出', CASE WHEN $3 THEN NOW() END, CASE WHEN $3 THEN 'organizer' END
    FROM game_participants WHERE game_id = $1 AND group_player_id = $2 RETURNING id`, [gameId, playerId, deleted]);
  return result.rows[0].id;
}

describe("年間まとめ（実際のPostgreSQLで集計・更新・グループ分離を検証）", () => {
  beforeAll(async () => {
    state.db = new PGlite();
    const directory = resolve("migrations");
    for (const name of (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort()) {
      await db().exec((await readFile(resolve(directory, name), "utf8"))
        .replace("CREATE EXTENSION IF NOT EXISTS pgcrypto;", ""));
    }
  }, 30_000);
  afterAll(async () => { await state.db?.close(); });
  beforeEach(async () => {
    await db().exec("TRUNCATE groups, players CASCADE");
    await db().query("INSERT INTO groups (id, name, public_code) VALUES ($1, 'test', 'test'), ($2, 'other', 'other')", [group, otherGroup]);
    for (const [id, name, groupId] of [[alice, "Alice", group], [bob, "Bob", group], [outsider, "Other", otherGroup]]) {
      await db().query("INSERT INTO players (id, display_name) VALUES ($1, $2)", [id, name]);
      await db().query("INSERT INTO group_players (id, group_id, player_id) VALUES ($1, $2, $1)", [id, groupId]);
    }
  });

  it("JST年境界・確定状態・グループを絞り、12月の追加確定も再閲覧で反映する", async () => {
    expect((await read()).group.gamesPlayed).toBe(0);
    await addGame("2025-12-31T14:59:59.999Z");
    await addGame("2025-12-31T15:00:00Z");
    await addGame("2026-12-31T14:59:59.999Z", "finalized", group, [bob, alice]);
    await addGame("2026-12-31T15:00:00Z");
    const pending = await addGame("2026-12-15T10:00:00Z", "open");
    await addGame("2026-12-15T11:00:00Z", "draft");
    await addGame("2026-12-20T10:00:00Z", "finalized", otherGroup, [outsider]);
    const recap = await read();
    expect(recap.group).toMatchObject({ gamesPlayed: 2, totalEntries: 4, uniquePlayers: 2 });
    expect(recap.group.mostWinsPlayers.map((p) => [p.displayName, p.value])).toEqual([["Alice", 1], ["Bob", 1]]);
    expect(recap.player).toMatchObject({ gamesPlayed: 2, wins: 1, totalNetBb: 0 });
    await db().query("UPDATE games SET status = 'finalized', finalized_at = NOW() WHERE id = $1", [pending]);
    expect((await read()).group.gamesPlayed).toBe(3);
    expect((await read()).player.totalNetBb).toBe(20);
    // Reopening a game must remove it from the current summary again.
    await db().query("UPDATE games SET status = 'open', finalized_at = NULL WHERE id = $1", [pending]);
    expect((await read()).group.gamesPlayed).toBe(2);
  });

  it("STORIESの未確定・削除済み・別年・別グループを除き、称号を本人の獲得年で絞る", async () => {
    const game = await addGame("2026-12-01T00:00:00Z");
    const ownPost = await addPost(game, alice);
    const friendPost = await addPost(game, bob);
    for (const [post, reactor] of [[ownPost, bob], [friendPost, alice]]) {
      for (const type of ["nice", "fire"]) {
        await db().query("INSERT INTO game_story_reactions (game_story_post_id, group_player_id, reaction_type) VALUES ($1, $2, $3)", [post, reactor, type]);
      }
    }
    for (const status of ["open", "draft"]) await addPost(await addGame("2026-12-02T00:00:00Z", status), alice);
    await addPost(await addGame("2026-12-03T00:00:00Z"), alice, true);
    await addPost(await addGame("2026-12-31T15:00:00Z"), alice);
    await addPost(await addGame("2026-12-04T00:00:00Z", "finalized", otherGroup, [outsider]), outsider);
    for (const [player, code, at] of [
      [alice, "first-win", "2025-12-31T15:00:00Z"],
      [alice, "five-games", "2026-12-31T15:00:00Z"],
      [bob, "first-win", "2026-12-01T00:00:00Z"],
      [outsider, "first-win", "2026-12-01T00:00:00Z"],
    ]) {
      await db().query(`INSERT INTO player_achievements (group_player_id, achievement_id, unlocked_at)
        SELECT $1, id, $3 FROM achievements WHERE code = $2`, [player, code, at]);
    }
    const recap = await read();
    expect(recap.stories).toEqual({ postsCreated: 1, reactionsReceived: 2, reactedPostCount: 1 });
    expect(recap.achievements.map((a) => a.name)).toEqual(["初戴冠"]);
  });

  it("プロフィールセッションは本人の所属グループだけに有効で、失効後は利用できない", async () => {
    await db().query(`INSERT INTO player_profile_sessions (player_id, token_hash, expires_at)
      VALUES ($1, 'test-token-hash', NOW() + INTERVAL '1 day')`, [alice]);
    expect(await findPlayerProfileBySession(group, "test-token-hash")).toMatchObject({ groupPlayerId: alice });
    expect(await findPlayerProfileBySession(otherGroup, "test-token-hash")).toBeNull();
    await db().exec("UPDATE player_profile_sessions SET revoked_at = NOW()");
    expect(await findPlayerProfileBySession(group, "test-token-hash")).toBeNull();
  });
});
