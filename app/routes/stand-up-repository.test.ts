import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it, vi } from "vitest";
import { evaluateAchievements } from "@domain/achievement/evaluate-achievements";
import type { DatabaseTransaction } from "@server/db/client.server";

const state = vi.hoisted(() => ({ db: null as PGlite | null }));
vi.mock("@server/db/client.server", () => ({
  queryDatabase: async (sql: string, values: unknown[] = []) => {
    const result = await state.db!.query(sql, values);
    return { ...result, rowCount: result.affectedRows };
  },
}));

import {
  cancelTableEvent,
  createStandUpLoserTableEvent,
  listFinalizedGameTableEvents,
  listOpenGameTableEvents,
} from "@server/repositories/table-event-repository.server";
import { findGameForGroup, insertGame, updateLocalRules } from "@server/repositories/game-repository.server";
import { getOpenGameTableEventCounts } from "@server/repositories/participant-repository.server";
import {
  insertAchievementUnlocks,
  listAchievementHistoryGames,
} from "@server/repositories/achievement-repository.server";

describe("STAND UP migration・repository統合", () => {
  it("既存イベントを保ち、記録・取消・確定後の表示と称号を実SQLで検証する", async () => {
    const db = new PGlite();
    state.db = db;
    try {
      const directory = resolve("migrations");
      const migration = "0037_add_stand_up_loser_event.sql";
      for (const name of (await readdir(directory)).filter((name) => name.endsWith(".sql") && name < migration).sort()) {
        const sql = (await readFile(resolve(directory, name), "utf8"))
          .replace("CREATE EXTENSION IF NOT EXISTS pgcrypto;", "");
        await db.exec(sql);
      }

      const groupId = crypto.randomUUID();
      const gameId = crypto.randomUUID();
      const playerId = crypto.randomUUID();
      await db.query("INSERT INTO groups (id, name, public_code) VALUES ($1, 'test', 'test')", [groupId]);
      await db.query(`INSERT INTO games (id, group_id, title, played_at, initial_chips, rebuy_chips, venue_cost, rounding_unit, first_place_cost, second_place_cost, third_place_cost)
        VALUES ($1, $2, 'test', NOW(), 20000, 20000, 0, 100, 0, 0, 0)`, [gameId, groupId]);
      await db.query("INSERT INTO players (id, display_name) VALUES ($1, 'ラストプレイヤー')", [playerId]);
      await db.query("INSERT INTO group_players (id, group_id, player_id) VALUES ($1, $2, $1)", [playerId, groupId]);
      await db.query("INSERT INTO game_participants (game_id, group_player_id) VALUES ($1, $2)", [gameId, playerId]);
      const insertEvent = (type: string, subject: string | null) => db.query(
        `INSERT INTO game_table_events (command_id, game_id, event_type, subject_group_player_id, recorded_by_type)
         VALUES ($1, $2, $3, $4, 'organizer')`, [crypto.randomUUID(), gameId, type, subject],
      );
      await insertEvent("seven_deuce", playerId);
      await insertEvent("bomb_pot", null);
      await insertEvent("all_in", null);
      const legacyEvents = (await db.query("SELECT * FROM game_table_events ORDER BY id")).rows;

      // Match the production runner's per-file transaction without any network DB.
      await db.transaction(async (tx) => {
        await tx.exec(await readFile(resolve(directory, migration), "utf8"));
      });
      expect((await db.query("SELECT * FROM game_table_events ORDER BY id")).rows).toEqual(legacyEvents);
      expect((await db.query("SELECT name, icon_key FROM achievements WHERE code = 'stand-up-last'")).rows)
        .toEqual([{ name: "立ちっぱなし", icon_key: "arrows-up-down" }]);
      await expect(insertEvent("stand_up_loser", null)).rejects.toMatchObject({ constraint: "game_table_events_subject_valid" });
      await expect(insertEvent("bomb_pot", playerId)).rejects.toMatchObject({ constraint: "game_table_events_subject_valid" });
      await expect(insertEvent("unknown", null)).rejects.toMatchObject({ constraint: "game_table_events_type_valid" });

      // A deploy before explicit migration approval must keep the old behavior working.
      expect((await findGameForGroup(groupId, gameId))?.standUpRuleEnabled).toBe(true);
      expect(await updateLocalRules(groupId, gameId, { sevenDeuceRuleEnabled: true, bombPotRuleEnabled: true, standUpRuleEnabled: true })).toBe(true);
      await expect(updateLocalRules(groupId, gameId, { sevenDeuceRuleEnabled: true, bombPotRuleEnabled: true, standUpRuleEnabled: false })).rejects.toMatchObject({ name: "StandUpRuleUnavailableError" });
      const newGameInput = {
        title: "設定テスト", playedAt: "2026-11-04T00:00:00Z", initialChips: 20000,
        smallBlindChips: 100, bigBlindChips: 200, bigBlindAnteChips: 200,
        initialStackBb: 100, rebuyChips: 20000, chipDistribution: null,
        venueCost: 0, roundingUnit: 100, firstPlaceCost: 0, secondPlaceCost: 0,
        thirdPlaceCost: 0, previewParticipantCount: 2, costShares: [0, 0], bbRate: 0,
        sevenDeuceRuleEnabled: true, bombPotRuleEnabled: true, standUpRuleEnabled: true,
      };
      const legacyCreated = await insertGame(groupId, newGameInput);
      expect((await findGameForGroup(groupId, legacyCreated))?.standUpRuleEnabled).toBe(true);
      await expect(insertGame(groupId, { ...newGameInput, standUpRuleEnabled: false })).rejects.toMatchObject({ name: "StandUpRuleUnavailableError" });
      await db.exec(await readFile(resolve(directory, "0039_add_stand_up_rule.sql"), "utf8"));
      expect((await db.query("SELECT stand_up_rule_enabled FROM games WHERE id = $1", [gameId])).rows).toEqual([{ stand_up_rule_enabled: true }]);
      const created = await insertGame(groupId, { ...newGameInput, standUpRuleEnabled: false });
      expect((await findGameForGroup(groupId, created))?.standUpRuleEnabled).toBe(false);
      const participantBefore = (await db.query("SELECT * FROM game_participants")).rows;
      const input = { actor: { groupPlayerId: playerId, type: "participant" as const }, commandId: crypto.randomUUID(), gameId, groupId, subjectGroupPlayerId: playerId };
      const eventId = await createStandUpLoserTableEvent(input);
      expect(eventId).not.toBeNull();
      expect(await createStandUpLoserTableEvent(input)).toBeNull();
      expect(await createStandUpLoserTableEvent({ ...input, commandId: crypto.randomUUID(), subjectGroupPlayerId: crypto.randomUUID() })).toBeNull();
      expect(await createStandUpLoserTableEvent({ ...input, commandId: crypto.randomUUID(), groupId: crypto.randomUUID() })).toBeNull();
      expect(await getOpenGameTableEventCounts(groupId, gameId))
        .toEqual({ allInCount: 1, bombPotCount: 1, sevenDeuceCount: 1, standUpCount: 1 });
      expect(await listOpenGameTableEvents(groupId, gameId)).toContainEqual(expect.objectContaining({
        id: eventId, type: "stand_up_loser", subject: expect.objectContaining({ groupPlayerId: playerId }),
      }));

      expect(await updateLocalRules(groupId, gameId, { sevenDeuceRuleEnabled: true, bombPotRuleEnabled: true, standUpRuleEnabled: false })).toBe(true);
      expect((await findGameForGroup(groupId, gameId))?.standUpRuleEnabled).toBe(false);
      expect(await createStandUpLoserTableEvent({ ...input, commandId: crypto.randomUUID() })).toBeNull();
      expect((await listOpenGameTableEvents(groupId, gameId)).some((event) => event.id === eventId)).toBe(true);
      // Rule changes do not remove historical events or change achievement evaluation.
      await db.query("UPDATE games SET stand_up_rule_enabled = TRUE WHERE id = $1", [gameId]);
      const canceledId = await createStandUpLoserTableEvent({ ...input, commandId: crypto.randomUUID() });
      expect(await cancelTableEvent({ ...input, eventId: canceledId! })).toBe(true);
      expect((await getOpenGameTableEventCounts(groupId, gameId)).standUpCount).toBe(1);
      expect((await db.query("SELECT * FROM game_participants")).rows).toEqual(participantBefore);

      const transaction = { query: (sql: string, values?: unknown[]) => db.query(sql, values) } as DatabaseTransaction;
      expect(await listAchievementHistoryGames(transaction, groupId, [playerId])).toEqual([]);
      await db.query(`INSERT INTO game_results (game_id, group_player_id, remaining_chips, settlement_rebuy_count, score, rank, cost_share)
        VALUES ($1, $2, 20000, 0, 20000, 1, 0)`, [gameId, playerId]);
      await db.query("UPDATE games SET status = 'finalized', finalized_at = NOW() WHERE id = $1", [gameId]);
      expect(await updateLocalRules(groupId, gameId, { sevenDeuceRuleEnabled: true, bombPotRuleEnabled: true, standUpRuleEnabled: false })).toBe(false);
      expect(await createStandUpLoserTableEvent({ ...input, commandId: crypto.randomUUID() })).toBeNull();
      expect(await cancelTableEvent({ ...input, eventId: eventId! })).toBe(false);
      const timeline = await listFinalizedGameTableEvents(groupId, gameId);
      expect(timeline.filter((event) => event.type === "stand_up_loser").map((event) => event.id)).toEqual([eventId]);
      const history = await listAchievementHistoryGames(transaction, groupId, [playerId]);
      expect(history[0]?.standUpLoserCount).toBe(1);
      const unlocks = evaluateAchievements(history).map((unlock) => ({ groupPlayerId: playerId, unlock }));
      await insertAchievementUnlocks(transaction, groupId, unlocks);
      await insertAchievementUnlocks(transaction, groupId, unlocks);
      expect((await db.query(`SELECT achievement.name, unlocked.source_game_id FROM player_achievements AS unlocked
        JOIN achievements AS achievement ON achievement.id = unlocked.achievement_id
        WHERE achievement.code = 'stand-up-last'`)).rows)
        .toEqual([{ name: "立ちっぱなし", source_game_id: gameId }]);
    } finally {
      await db.close();
      state.db = null;
    }
  }, 30_000);
});
