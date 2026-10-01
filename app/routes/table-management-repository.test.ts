import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { orderSubTable, subStayMinutes } from "@domain/table-management/table-management";

const state = vi.hoisted(() => ({ db: null as PGlite | null }));
vi.mock("@server/db/client.server", () => ({
  queryDatabase: async (sql: string, values: unknown[] = []) => state.db!.query(sql, values),
  withTransaction: async (work: (tx: unknown) => Promise<unknown>) => state.db!.transaction(work),
}));
import { listCurrentGameParticipants } from "@server/repositories/participant-repository.server";
import { moveTableParticipant, readTableManagement, startTableManagement } from "@server/repositories/table-management-repository.server";

const group = "00000000-0000-4000-8000-000000000001";
const game = "00000000-0000-4000-8000-000000000002";
const ids = [3, 4, 5].map((n) => `00000000-0000-4000-8000-00000000000${n}`);
const db = () => state.db!;
const read = () => readTableManagement(group, game);
const start = () => startTableManagement({ groupId: group, gameId: game, mainIds: [ids[0]], subIds: ids.slice(1) });
const move = (groupPlayerId: string, fromTable: "MAIN" | "SUB", expectedSubEnteredAt: string | null, commandId = crypto.randomUUID()) =>
  moveTableParticipant({ gameId: game, groupId: group, groupPlayerId, fromTable, toTable: fromTable === "MAIN" ? "SUB" : "MAIN", expectedSubEnteredAt, commandId, actorPlayerId: null });

describe("卓管理 repository（実際のPostgreSQLでmigrationと状態遷移を検証）", () => {
  beforeAll(async () => {
    state.db = new PGlite();
    const directory = resolve("migrations");
    for (const name of (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort()) {
      // PGlite has gen_random_uuid built in; the pgcrypto extension is unnecessary here.
      const sql = (await readFile(resolve(directory, name), "utf8")).replace("CREATE EXTENSION IF NOT EXISTS pgcrypto;", "");
      await db().exec(sql);
    }
  }, 30_000);
  afterAll(async () => { await state.db?.close(); });
  beforeEach(async () => {
    await db().exec("TRUNCATE groups, players CASCADE");
    await db().query("INSERT INTO groups (id, name, public_code) VALUES ($1, 'test', 'test')", [group]);
    await db().query(`INSERT INTO games (id, group_id, title, played_at, initial_chips, rebuy_chips, venue_cost, rounding_unit, first_place_cost, second_place_cost, third_place_cost)
      VALUES ($1, $2, 'test', NOW(), 20000, 20000, 0, 100, 0, 0, 0)`, [game, group]);
    for (const [i, id] of ids.entries()) {
      await db().query("INSERT INTO players (id, display_name) VALUES ($1, $2)", [id, ["かずと", "岩田", "ひろ"][i]]);
      await db().query("INSERT INTO group_players (id, group_id, player_id) VALUES ($1, $2, $1)", [id, group]);
      await db().query("INSERT INTO game_participants (game_id, group_player_id) VALUES ($1, $2)", [game, id]);
    }
  });

  it("OFF開催では既存の入力を維持し、途中から開始してもチップやリバイを変えない", async () => {
    await db().query("UPDATE game_participants SET remaining_chips = 18000, total_rebuy_count = 2, outstanding_rebuy_count = 1 WHERE group_player_id = $1", [ids[0]]);
    expect((await read())!.startedAt).toBeNull();
    expect(await move(ids[0], "MAIN", null)).toBe(false);
    expect(await start()).toBe(true);
    const panel = (await read())!;
    expect(panel.participants.map((seat) => seat.table)).toEqual(["MAIN", "SUB", "SUB"]);
    expect(panel.participants[1].subEnteredAt).toBe(panel.participants[2].subEnteredAt);
    expect(Date.parse(panel.participants[1].subEnteredAt!)).toBe(Date.parse(panel.startedAt!));
    const untouched = await db().query("SELECT remaining_chips, total_rebuy_count, outstanding_rebuy_count FROM game_participants WHERE group_player_id = $1", [ids[0]]);
    expect(untouched.rows[0]).toEqual({ remaining_chips: 18000, total_rebuy_count: 2, outstanding_rebuy_count: 1 });
    expect(await start()).toBe(false);
  });

  it("PLAYERSの既存参加者取得は保存された卓を返し、移動後の人数にも使える", async () => {
    expect((await listCurrentGameParticipants(group, game)).map((item) => item.tablePosition)).toEqual(["MAIN", "MAIN", "MAIN"]);
    await start();
    expect((await listCurrentGameParticipants(group, game)).filter((item) => item.tablePosition === "SUB")).toHaveLength(2);
    const candidate = orderSubTable((await read())!.participants)[0];
    await move(candidate.groupPlayerId, "SUB", candidate.subEnteredAt);
    expect((await listCurrentGameParticipants(group, game)).filter((item) => item.tablePosition === "SUB")).toHaveLength(1);
  });

  it("滞在順に候補が更新され、再入場は新しい時刻・更新後も同じ状態と履歴になる", async () => {
    await start();
    await db().query("UPDATE game_participants SET sub_entered_at = NOW() - INTERVAL '42 minutes' WHERE group_player_id = $1", [ids[1]]);
    await db().query("UPDATE game_participants SET sub_entered_at = NOW() - INTERVAL '31 minutes' WHERE group_player_id = $1", [ids[2]]);
    const before = (await read())!;
    const candidate = orderSubTable(before.participants)[0];
    expect(candidate.groupPlayerId).toBe(ids[1]);
    expect(subStayMinutes(candidate.subEnteredAt!, Date.parse(before.serverNow))).toBe(42);
    const commandId = crypto.randomUUID();
    expect(await move(ids[1], "SUB", candidate.subEnteredAt, commandId)).toBe(true);
    expect(await move(ids[1], "SUB", candidate.subEnteredAt, commandId)).toBe(true);
    expect(await move(ids[1], "SUB", candidate.subEnteredAt)).toBe(false);
    const after = (await read())!;
    expect(orderSubTable(after.participants)[0].groupPlayerId).toBe(ids[2]);
    expect(after.participants.find((seat) => seat.groupPlayerId === ids[1])!.subEnteredAt).toBeNull();
    expect(after.moves).toHaveLength(1);
    expect(await move(ids[1], "MAIN", null)).toBe(true);
    const reentered = (await read())!;
    const newSeat = reentered.participants.find((seat) => seat.groupPlayerId === ids[1])!;
    expect(Date.parse(newSeat.subEnteredAt!)).toBeGreaterThan(Date.parse(candidate.subEnteredAt!));
    expect(subStayMinutes(newSeat.subEnteredAt!, Date.parse(reentered.serverNow))).toBe(0);
    expect(orderSubTable(reentered.participants)[0].groupPlayerId).toBe(ids[2]);
    // A stale SUB->MAIN request from the previous stay must not move the reentered player.
    expect(await move(ids[1], "SUB", candidate.subEnteredAt)).toBe(false);
    expect((await read())!.participants).toEqual(reentered.participants);
    expect((await read())!.moves).toEqual(reentered.moves);
    expect(reentered.moves).toHaveLength(2);
  });

  it("他開催・振り分け漏れ・重複を拒否し、開始後の途中参加はMAINで待機時計なし", async () => {
    expect(await startTableManagement({ groupId: ids[0], gameId: game, mainIds: [ids[0]], subIds: ids.slice(1) })).toBe(false);
    expect(await startTableManagement({ groupId: group, gameId: game, mainIds: [ids[0]], subIds: [ids[1]] })).toBe(false);
    expect(await startTableManagement({ groupId: group, gameId: game, mainIds: [ids[0], ids[1]], subIds: [ids[1]] })).toBe(false);
    expect((await read())!.startedAt).toBeNull();
    await start();
    await db().query("DELETE FROM game_participants WHERE group_player_id = $1", [ids[0]]);
    await db().query("INSERT INTO game_participants (game_id, group_player_id) VALUES ($1, $2)", [game, ids[0]]);
    const joined = (await read())!.participants.find((seat) => seat.groupPlayerId === ids[0])!;
    expect(joined).toMatchObject({ table: "MAIN", subEnteredAt: null });
    await db().query("UPDATE games SET status = 'finalized', finalized_at = NOW() WHERE id = $1", [game]);
    expect(await move(ids[0], "MAIN", null)).toBe(false);
  });

  it("履歴INSERTが失敗した場合は卓移動もrollbackする", async () => {
    await start();
    const before = (await read())!;
    await expect(moveTableParticipant({ gameId: game, groupId: group, groupPlayerId: ids[0], fromTable: "MAIN", toTable: "SUB", expectedSubEnteredAt: null, commandId: crypto.randomUUID(), actorPlayerId: crypto.randomUUID() })).rejects.toThrow();
    expect((await read())!.participants).toEqual(before.participants);
    expect((await read())!.moves).toEqual([]);
  });
});
