import { queryDatabase, type DatabaseTransaction } from "@server/db/client.server";
import type { AchievementUnlock } from "@domain/achievement/evaluate-achievements";
import type {
  AchievementIconKey,
  PlayerAchievementCollection,
  PlayerAchievementItem,
} from "@shared-types/achievement";

interface AchievementHistoryRow {
  group_player_id: string;
  game_id: string;
  rank: number;
  net_bb: string | null;
  initial_chips: string;
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
  netBb: number;
}

export async function listAchievementHistoryGames(
  transaction: DatabaseTransaction,
  groupId: string,
  groupPlayerIds: string[],
): Promise<AchievementHistoryGame[]> {
  if (groupPlayerIds.length === 0) return [];
  const result = await transaction.query<AchievementHistoryRow>(
    `
      SELECT
        game_result.group_player_id,
        game_result.game_id,
        game_result.rank,
        game.initial_chips,
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
        AND game_result.group_player_id = ANY($2::UUID[])
      ORDER BY game_result.group_player_id,
               game.played_at ASC,
               game.finalized_at ASC,
               game.id ASC
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
    netBb: Number(row.net_bb),
  }));
}

export async function insertAchievementUnlocks(
  transaction: DatabaseTransaction,
  groupId: string,
  groupPlayerId: string,
  unlocks: AchievementUnlock[],
): Promise<void> {
  for (const unlock of unlocks) {
    await transaction.query(
      `
        INSERT INTO player_achievements (
          group_player_id, achievement_id, source_game_id
        )
        SELECT group_player.id, achievement.id, game.id
        FROM group_players AS group_player
        INNER JOIN games AS game
          ON game.id = $4 AND game.group_id = group_player.group_id
        INNER JOIN achievements AS achievement ON achievement.code = $3
        WHERE group_player.id = $2 AND group_player.group_id = $1
        ON CONFLICT (group_player_id, achievement_id) DO NOTHING
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
