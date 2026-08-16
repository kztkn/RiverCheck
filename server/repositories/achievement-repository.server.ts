import { queryDatabase, type DatabaseTransaction } from "@server/db/client.server";
import {
  evaluatedAchievementCodes,
  type AchievementUnlock,
} from "@domain/achievement/evaluate-achievements";
import type {
  AchievementIconKey,
  PlayerAchievementCollection,
  PlayerAchievementItem,
} from "@shared-types/achievement";

interface AchievementHistoryRow {
  group_player_id: string;
  game_id: string;
  rank: number;
  participant_count: string;
  net_bb: string | null;
  initial_chips: string;
  total_rebuy_count: number | null;
  tracked_outstanding_rebuy_count: number | null;
  settlement_rebuy_count: number;
}

interface AchievementCollectionRow {
  id: string;
  code: string;
  name: string;
  description: string;
  icon_key: AchievementIconKey;
  category: string;
  is_hidden: boolean;
  unlocked_at: Date | null;
  source_game_id: string | null;
  source_game_title: string | null;
  source_game_played_at: Date | null;
  is_equipped: boolean;
}

export interface AchievementHistoryGame {
  groupPlayerId: string;
  gameId: string;
  rank: number;
  participantCount: number;
  netBb: number;
  totalRebuyCount: number;
  outstandingRebuyCount: number | null;
  settlementRebuyCount: number;
}

export async function listAchievementHistoryGames(
  transaction: DatabaseTransaction,
  groupId: string,
  groupPlayerIds: string[],
): Promise<AchievementHistoryGame[]> {
  if (groupPlayerIds.length === 0) return [];
  const result = await transaction.query<AchievementHistoryRow>(
    `
      WITH finalized_results AS (
        SELECT
          game_result.group_player_id,
          game_result.game_id,
          game_result.rank,
          COUNT(*) OVER (
            PARTITION BY game_result.game_id
          ) AS participant_count,
          game_result.total_rebuy_count,
          game_result.tracked_outstanding_rebuy_count,
          game_result.settlement_rebuy_count,
          game.initial_chips,
          game.played_at,
          game.finalized_at,
          CASE
            WHEN game.initial_chips > 0 THEN
              ((game_result.score - game.initial_chips)::NUMERIC * 100)
                / game.initial_chips
            ELSE NULL
          END AS net_bb
        FROM game_results AS game_result
        INNER JOIN games AS game ON game.id = game_result.game_id
        WHERE game.group_id = $1
          AND game.status = 'finalized'
      )
      SELECT
        group_player_id,
        game_id,
        rank,
        participant_count,
        total_rebuy_count,
        tracked_outstanding_rebuy_count,
        settlement_rebuy_count,
        initial_chips,
        net_bb
      FROM finalized_results
      WHERE group_player_id = ANY($2::UUID[])
      ORDER BY group_player_id,
               played_at ASC,
               finalized_at ASC,
               game_id ASC
    `,
    [groupId, groupPlayerIds],
  );

  if (
    result.rows.some(
      (row) => Number(row.initial_chips) <= 0 || row.net_bb === null,
    )
  ) {
    throw new Error("実績を判定できない確定済み開催があります。");
  }

  return result.rows.map((row) => ({
    groupPlayerId: row.group_player_id,
    gameId: row.game_id,
    rank: row.rank,
    participantCount: Number(row.participant_count),
    netBb: Number(row.net_bb),
    totalRebuyCount:
      row.total_rebuy_count ?? row.settlement_rebuy_count,
    outstandingRebuyCount: row.tracked_outstanding_rebuy_count,
    settlementRebuyCount: row.settlement_rebuy_count,
  }));
}

export async function synchronizeAchievementUnlocks(
  transaction: DatabaseTransaction,
  groupId: string,
  groupPlayerId: string,
  unlocks: AchievementUnlock[],
): Promise<void> {
  const unlockedCodes = unlocks.map((unlock) => unlock.code);

  await transaction.query(
    `
      UPDATE group_players AS group_player
      SET equipped_achievement_id = NULL
      FROM achievements AS achievement
      WHERE group_player.id = $2
        AND group_player.group_id = $1
        AND group_player.equipped_achievement_id = achievement.id
        AND achievement.code = ANY($3::TEXT[])
        AND NOT (achievement.code = ANY($4::TEXT[]))
    `,
    [groupId, groupPlayerId, [...evaluatedAchievementCodes], unlockedCodes],
  );

  await transaction.query(
    `
      DELETE FROM player_achievements AS player_achievement
      USING achievements AS achievement, group_players AS group_player
      WHERE player_achievement.group_player_id = group_player.id
        AND player_achievement.achievement_id = achievement.id
        AND group_player.id = $2
        AND group_player.group_id = $1
        AND achievement.code = ANY($3::TEXT[])
        AND NOT (achievement.code = ANY($4::TEXT[]))
    `,
    [groupId, groupPlayerId, [...evaluatedAchievementCodes], unlockedCodes],
  );

  for (const unlock of unlocks) {
    await transaction.query(
      `
        INSERT INTO player_achievements (
          group_player_id, achievement_id, source_game_id, unlocked_at
        )
        SELECT group_player.id, achievement.id, game.id,
               COALESCE(game.finalized_at, game.updated_at, game.played_at)
        FROM group_players AS group_player
        INNER JOIN games AS game
          ON game.id = $4 AND game.group_id = group_player.group_id
        INNER JOIN achievements AS achievement ON achievement.code = $3
        WHERE group_player.id = $2 AND group_player.group_id = $1
        ON CONFLICT (group_player_id, achievement_id) DO UPDATE
        SET source_game_id = EXCLUDED.source_game_id,
            unlocked_at = EXCLUDED.unlocked_at
      `,
      [groupId, groupPlayerId, unlock.code, unlock.sourceGameId],
    );
  }
}

export async function listPlayerAchievementCollection(
  groupId: string,
  groupPlayerId: string,
): Promise<PlayerAchievementCollection> {
  const result = await queryDatabase<AchievementCollectionRow>(
    `
      WITH target_player AS (
        SELECT id, equipped_achievement_id
        FROM group_players
        WHERE id = $2 AND group_id = $1
      )
      SELECT
        achievement.id,
        achievement.code,
        achievement.name,
        achievement.description,
        achievement.icon_key,
        achievement.category,
        achievement.is_hidden,
        player_achievement.unlocked_at,
        source_game.id AS source_game_id,
        source_game.title AS source_game_title,
        source_game.played_at AS source_game_played_at,
        COALESCE(
          achievement.id = target_player.equipped_achievement_id,
          FALSE
        ) AS is_equipped
      FROM target_player
      CROSS JOIN achievements AS achievement
      LEFT JOIN player_achievements AS player_achievement
        ON player_achievement.group_player_id = target_player.id
       AND player_achievement.achievement_id = achievement.id
      LEFT JOIN games AS source_game
        ON source_game.id = player_achievement.source_game_id
      ORDER BY achievement.sort_order ASC, achievement.code ASC
    `,
    [groupId, groupPlayerId],
  );

  const items: PlayerAchievementItem[] = result.rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    iconKey: row.icon_key,
    category: row.category,
    isHidden: row.is_hidden,
    isUnlocked: row.unlocked_at !== null,
    isEquipped: row.is_equipped,
    unlockedAt: row.unlocked_at?.toISOString() ?? null,
    sourceGame:
      row.source_game_id && row.source_game_title && row.source_game_played_at
        ? {
            id: row.source_game_id,
            title: row.source_game_title,
            playedAt: row.source_game_played_at.toISOString(),
          }
        : null,
  }));
  const equipped = items.find((item) => item.isEquipped && item.isUnlocked);

  return {
    unlockedCount: items.filter((item) => item.isUnlocked).length,
    totalCount: items.length,
    equippedAchievement: equipped
      ? {
          id: equipped.id,
          code: equipped.code,
          name: equipped.name,
          description: equipped.description,
          iconKey: equipped.iconKey,
          category: equipped.category,
        }
      : null,
    items,
  };
}

export async function listUnlockedAchievementIds(
  groupPlayerId: string,
): Promise<string[]> {
  const result = await queryDatabase<{ achievement_id: string }>(
    `
      SELECT achievement_id
      FROM player_achievements
      WHERE group_player_id = $1
    `,
    [groupPlayerId],
  );
  return result.rows.map((row) => row.achievement_id);
}
