import { evaluateAchievements } from "@domain/achievement/evaluate-achievements";
import {
  insertAchievementUnlocks,
  listAchievementHistoryGames,
  listAchievementReactionSummaries,
  listPendingAchievementNotifications,
  listPlayerAchievementCollection,
  listUnlockedAchievementIds,
  markAchievementNotificationSeen,
} from "@server/repositories/achievement-repository.server";
import {
  withTransaction,
  type DatabaseTransaction,
} from "@server/db/client.server";
import type {
  PendingAchievementNotification,
  PlayerAchievementCollection,
} from "@shared-types/achievement";

export async function awardAchievementsForPlayers(
  transaction: DatabaseTransaction,
  groupId: string,
  groupPlayerIds: string[],
): Promise<void> {
  const uniquePlayerIds = [...new Set(groupPlayerIds)];
  if (uniquePlayerIds.length === 0) return;

  const history = await listAchievementHistoryGames(
    transaction,
    groupId,
    uniquePlayerIds,
  );
  const reactionSummaries = await listAchievementReactionSummaries(
    transaction,
    groupId,
    uniquePlayerIds,
  );
  const reactionByPlayer = new Map(
    reactionSummaries.map((summary) => [summary.groupPlayerId, summary]),
  );

  const playerUnlocks = uniquePlayerIds.flatMap((groupPlayerId) => {
    const games = history
      .filter((game) => game.groupPlayerId === groupPlayerId)
      .map((game) => ({
        gameId: game.gameId,
        rank: game.rank,
        participantCount: game.participantCount,
        netBb: game.netBb,
        totalRebuyCount: game.totalRebuyCount,
        outstandingRebuyCount: game.outstandingRebuyCount,
        settlementRebuyCount: game.settlementRebuyCount,
        sevenDeuceCount: game.sevenDeuceCount,
        allInWinCount: game.allInWinCount,
        allInLossCount: game.allInLossCount,
        storyPostCount: game.storyPostCount,
      }));
    const reaction = reactionByPlayer.get(groupPlayerId);
    return evaluateAchievements(games, {
      reactedStoryPostCount: reaction?.reactedStoryPostCount ?? 0,
      fifthReactedStoryGameId: reaction?.fifthReactedStoryGameId ?? null,
    }).map((unlock) => ({ groupPlayerId, unlock }));
  });

  await insertAchievementUnlocks(transaction, groupId, playerUnlocks);
}

export async function refreshAchievementsForPlayers(
  groupId: string,
  groupPlayerIds: string[],
): Promise<void> {
  await withTransaction((transaction) =>
    awardAchievementsForPlayers(transaction, groupId, groupPlayerIds)
  );
}

export async function getPlayerAchievementCollection(
  groupId: string,
  groupPlayerId: string,
): Promise<PlayerAchievementCollection> {
  const collection = await listPlayerAchievementCollection(groupId, groupPlayerId);
  return {
    ...collection,
    items: collection.items.map((achievement) =>
      achievement.isHidden && !achievement.isUnlocked
        ? {
            ...achievement,
            name: "???",
            description: "条件は秘密",
          }
        : achievement
    ),
  };
}

export async function getUnlockedPlayerAchievementIds(
  groupPlayerId: string,
): Promise<string[]> {
  return listUnlockedAchievementIds(groupPlayerId);
}

export async function getPendingPlayerAchievementNotifications(
  groupId: string,
  groupPlayerId: string,
): Promise<PendingAchievementNotification[]> {
  return listPendingAchievementNotifications(groupId, groupPlayerId);
}

export async function acknowledgePlayerAchievementNotification(
  groupId: string,
  groupPlayerId: string,
  playerAchievementId: string,
): Promise<boolean> {
  return markAchievementNotificationSeen(
    groupId,
    groupPlayerId,
    playerAchievementId,
  );
}
