import { queryDatabase, type DatabaseTransaction } from "@server/db/client.server";
import type {
  AchievementUnlock,
} from "@domain/achievement/evaluate-achievements";
import type {
  AchievementIconKey,
  PendingAchievementNotification,
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
  seven_deuce_count: number;
  all_in_win_count: number;
  all_in_loss_count: number;
  story_post_count: number;
}

interface AchievementReactionSummaryRow {
  group_player_id: string;
  reacted_story_post_count: number;
  fifth_reacted_story_game_id: string | null;
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

interface PendingAchievementRow {
  player_achievement_id: string;
  id: string;
  code: string;
  name: string;
  description: string;
  icon_key: AchievementIconKey;
  category: string;
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
  sevenDeuceCount: number;
  allInWinCount: number;
  allInLossCount: number;
  storyPostCount: number;
}

export interface AchievementReactionSummary {
  groupPlayerId: string;
  reactedStoryPostCount: number;
  fifthReactedStoryGameId: string | null;
}

export interface PlayerAchievementUnlock {
  groupPlayerId: string;
  unlock: AchievementUnlock;
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
      ),
      seven_deuce_metrics AS (
        SELECT
          event.game_id,
          event.subject_group_player_id AS group_player_id,
          COUNT(*)::INTEGER AS seven_deuce_count
        FROM game_table_events AS event
        INNER JOIN games AS game ON game.id = event.game_id
        WHERE game.group_id = $1
          AND game.status = 'finalized'
          AND event.event_type = 'seven_deuce'
          AND event.canceled_at IS NULL
          AND event.subject_group_player_id IS NOT NULL
        GROUP BY event.game_id, event.subject_group_player_id
      ),
      all_in_metrics AS (
        SELECT
          event.game_id,
          event_player.group_player_id,
          COUNT(*) FILTER (WHERE event_player.is_winner)::INTEGER AS all_in_win_count,
          COUNT(*) FILTER (WHERE NOT event_player.is_winner)::INTEGER AS all_in_loss_count
        FROM game_table_events AS event
        INNER JOIN games AS game ON game.id = event.game_id
        INNER JOIN game_table_event_players AS event_player
          ON event_player.event_id = event.id
        WHERE game.group_id = $1
          AND game.status = 'finalized'
          AND event.event_type = 'all_in'
          AND event.canceled_at IS NULL
        GROUP BY event.game_id, event_player.group_player_id
      ),
      story_metrics AS (
        SELECT
          participant.game_id,
          participant.group_player_id,
          COUNT(*)::INTEGER AS story_post_count
        FROM game_story_posts AS post
        INNER JOIN game_participants AS participant
          ON participant.id = post.game_participant_id
        INNER JOIN games AS game ON game.id = participant.game_id
        WHERE game.group_id = $1
          AND game.status = 'finalized'
          AND post.deleted_at IS NULL
        GROUP BY participant.game_id, participant.group_player_id
      )
      SELECT
        finalized_results.group_player_id,
        finalized_results.game_id,
        finalized_results.rank,
        finalized_results.participant_count,
        finalized_results.total_rebuy_count,
        finalized_results.tracked_outstanding_rebuy_count,
        finalized_results.settlement_rebuy_count,
        finalized_results.initial_chips,
        finalized_results.net_bb,
        COALESCE(seven_deuce_metrics.seven_deuce_count, 0) AS seven_deuce_count,
        COALESCE(all_in_metrics.all_in_win_count, 0) AS all_in_win_count,
        COALESCE(all_in_metrics.all_in_loss_count, 0) AS all_in_loss_count,
        COALESCE(story_metrics.story_post_count, 0) AS story_post_count
      FROM finalized_results
      LEFT JOIN seven_deuce_metrics
        ON seven_deuce_metrics.game_id = finalized_results.game_id
       AND seven_deuce_metrics.group_player_id = finalized_results.group_player_id
      LEFT JOIN all_in_metrics
        ON all_in_metrics.game_id = finalized_results.game_id
       AND all_in_metrics.group_player_id = finalized_results.group_player_id
      LEFT JOIN story_metrics
        ON story_metrics.game_id = finalized_results.game_id
       AND story_metrics.group_player_id = finalized_results.group_player_id
      WHERE finalized_results.group_player_id = ANY($2::UUID[])
      ORDER BY finalized_results.group_player_id,
               finalized_results.played_at ASC,
               finalized_results.finalized_at ASC,
               finalized_results.game_id ASC
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
    sevenDeuceCount: row.seven_deuce_count,
    allInWinCount: row.all_in_win_count,
    allInLossCount: row.all_in_loss_count,
    storyPostCount: row.story_post_count,
  }));
}

export async function listAchievementReactionSummaries(
  transaction: DatabaseTransaction,
  groupId: string,
  groupPlayerIds: string[],
): Promise<AchievementReactionSummary[]> {
  if (groupPlayerIds.length === 0) return [];
  const result = await transaction.query<AchievementReactionSummaryRow>(
    `
      WITH reacted_posts AS (
        SELECT
          reaction.group_player_id,
          post.id AS post_id,
          participant.game_id,
          MIN(reaction.created_at) AS first_reacted_at
        FROM game_story_reactions AS reaction
        INNER JOIN game_story_posts AS post
          ON post.id = reaction.game_story_post_id
        INNER JOIN game_participants AS participant
          ON participant.id = post.game_participant_id
        INNER JOIN games AS game ON game.id = participant.game_id
        WHERE game.group_id = $1
          AND game.status = 'finalized'
          AND post.deleted_at IS NULL
          AND reaction.group_player_id = ANY($2::UUID[])
        GROUP BY
          reaction.group_player_id,
          post.id,
          participant.game_id
      ),
      ranked_posts AS (
        SELECT
          reacted_posts.*,
          ROW_NUMBER() OVER (
            PARTITION BY group_player_id
            ORDER BY first_reacted_at ASC, post_id ASC
          ) AS reaction_number
        FROM reacted_posts
      )
      SELECT
        group_player_id,
        COUNT(*)::INTEGER AS reacted_story_post_count,
        MAX(game_id) FILTER (
          WHERE reaction_number = 5
        ) AS fifth_reacted_story_game_id
      FROM ranked_posts
      GROUP BY group_player_id
    `,
    [groupId, groupPlayerIds],
  );
  return result.rows.map((row) => ({
    groupPlayerId: row.group_player_id,
    reactedStoryPostCount: row.reacted_story_post_count,
    fifthReactedStoryGameId: row.fifth_reacted_story_game_id,
  }));
}

export async function insertAchievementUnlocks(
  transaction: DatabaseTransaction,
  groupId: string,
  playerUnlocks: PlayerAchievementUnlock[],
): Promise<void> {
  if (playerUnlocks.length === 0) return;
  await transaction.query(
    `
      WITH requested_unlocks AS (
        SELECT *
        FROM jsonb_to_recordset($2::JSONB) AS unlock(
          group_player_id UUID,
          code TEXT,
          source_game_id UUID
        )
      )
      INSERT INTO player_achievements (
        group_player_id,
        achievement_id,
        source_game_id,
        unlocked_at
      )
      SELECT
        group_player.id,
        achievement.id,
        game.id,
        COALESCE(game.finalized_at, game.updated_at, game.played_at)
      FROM requested_unlocks AS requested
      INNER JOIN group_players AS group_player
        ON group_player.id = requested.group_player_id
       AND group_player.group_id = $1
      INNER JOIN achievements AS achievement
        ON achievement.code = requested.code
      INNER JOIN games AS game
        ON game.id = requested.source_game_id
       AND game.group_id = $1
      ON CONFLICT (group_player_id, achievement_id) DO NOTHING
    `,
    [
      groupId,
      JSON.stringify(
        playerUnlocks.map(({ groupPlayerId, unlock }) => ({
          group_player_id: groupPlayerId,
          code: unlock.code,
          source_game_id: unlock.sourceGameId,
        })),
      ),
    ],
  );
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

export async function listPendingAchievementNotifications(
  groupId: string,
  groupPlayerId: string,
): Promise<PendingAchievementNotification[]> {
  const result = await queryDatabase<PendingAchievementRow>(
    `
      SELECT
        player_achievement.id AS player_achievement_id,
        achievement.id,
        achievement.code,
        achievement.name,
        achievement.description,
        achievement.icon_key,
        achievement.category
      FROM player_achievements AS player_achievement
      INNER JOIN group_players AS group_player
        ON group_player.id = player_achievement.group_player_id
      INNER JOIN achievements AS achievement
        ON achievement.id = player_achievement.achievement_id
      WHERE group_player.group_id = $1
        AND group_player.id = $2
        AND player_achievement.notified_at IS NULL
      ORDER BY player_achievement.unlocked_at ASC, achievement.sort_order ASC
      LIMIT 20
    `,
    [groupId, groupPlayerId],
  );
  return result.rows.map((row) => ({
    playerAchievementId: row.player_achievement_id,
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    iconKey: row.icon_key,
    category: row.category,
  }));
}

export async function markAchievementNotificationSeen(
  groupId: string,
  groupPlayerId: string,
  playerAchievementId: string,
): Promise<boolean> {
  const result = await queryDatabase(
    `
      UPDATE player_achievements AS player_achievement
      SET notified_at = COALESCE(player_achievement.notified_at, NOW())
      FROM group_players AS group_player
      WHERE player_achievement.id = $3
        AND player_achievement.group_player_id = $2
        AND group_player.id = player_achievement.group_player_id
        AND group_player.group_id = $1
    `,
    [groupId, groupPlayerId, playerAchievementId],
  );
  return result.rowCount === 1;
}
