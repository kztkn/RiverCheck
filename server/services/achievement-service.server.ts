import { waitUntil } from "cloudflare:workers";
import { evaluateAchievements } from "@domain/achievement/evaluate-achievements";
import {
  clearAchievementRefreshNeeded,
  insertAchievementUnlocks,
  listAchievementHistoryGames,
  listAchievementReactionSummaries,
  listPendingAchievementNotifications,
  listPlayerAchievementCollection,
  listUnlockedAchievementIds,
  lockAchievementRefreshTargets,
  markAchievementNotificationSeen,
  markAchievementRefreshNeeded,
} from "@server/repositories/achievement-repository.server";
import {
  withTransaction,
  type DatabaseTransaction,
} from "@server/db/client.server";
import type {
  PendingAchievementNotification,
  PlayerAchievementCollection,
} from "@shared-types/achievement";

interface AchievementRefreshContext {
  reason: string;
  gameId?: string;
}

function buildAchievementErrorLog(error: unknown) {
  const record =
    typeof error === "object" && error !== null
      ? (error as {
          name?: unknown;
          message?: unknown;
          code?: unknown;
          constraint?: unknown;
        })
      : null;
  const rawMessage =
    typeof record?.message === "string" ? record.message : String(error);

  return {
    errorType:
      typeof record?.name === "string" ? record.name : typeof error,
    errorMessage: rawMessage.slice(0, 500),
    errorCode:
      typeof record?.code === "string" ? record.code : undefined,
    constraint:
      typeof record?.constraint === "string" ? record.constraint : undefined,
  };
}

export async function awardAchievementsForPlayers(
  transaction: DatabaseTransaction,
  groupId: string,
  groupPlayerIds: string[],
): Promise<number> {
  const uniquePlayerIds = [...new Set(groupPlayerIds)];
  if (uniquePlayerIds.length === 0) return 0;

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

  return insertAchievementUnlocks(transaction, groupId, playerUnlocks);
}

export async function refreshAchievementsForPlayers(
  groupId: string,
  groupPlayerIds: string[],
): Promise<number> {
  const uniquePlayerIds = [...new Set(groupPlayerIds)];
  if (uniquePlayerIds.length === 0) return 0;

  return withTransaction(async (transaction) => {
    // Lock player rows before evaluating history. A newer mutation that marks
    // the same player dirty waits and leaves dirty=true after this refresh.
    const targets = await lockAchievementRefreshTargets(
      transaction,
      groupId,
      uniquePlayerIds,
    );
    if (targets.length === 0) return 0;
    const newUnlockCount = await awardAchievementsForPlayers(
      transaction,
      groupId,
      targets,
    );
    await clearAchievementRefreshNeeded(transaction, groupId, targets);
    return newUnlockCount;
  });
}

export async function markAchievementsDirtyBestEffort(
  groupId: string,
  groupPlayerIds: string[],
  context: AchievementRefreshContext,
): Promise<boolean> {
  const uniquePlayerIds = [...new Set(groupPlayerIds)];
  if (uniquePlayerIds.length === 0) return true;
  try {
    await withTransaction((transaction) =>
      markAchievementRefreshNeeded(transaction, groupId, uniquePlayerIds)
    );
    return true;
  } catch (error) {
    console.error("Failed to mark achievements for refresh", {
      ...buildAchievementErrorLog(error),
      gameId: context.gameId,
      playerCount: uniquePlayerIds.length,
      reason: context.reason,
    });
    return false;
  }
}

export async function refreshAchievementsBestEffort(
  groupId: string,
  groupPlayerIds: string[],
  context: AchievementRefreshContext,
): Promise<boolean> {
  const uniquePlayerIds = [...new Set(groupPlayerIds)];
  if (uniquePlayerIds.length === 0) return true;
  const startedAt = Date.now();
  console.info("Achievement refresh started", {
    gameId: context.gameId,
    playerCount: uniquePlayerIds.length,
    reason: context.reason,
  });
  try {
    const newUnlockCount = await refreshAchievementsForPlayers(
      groupId,
      uniquePlayerIds,
    );
    console.info("Achievement refresh succeeded", {
      durationMs: Date.now() - startedAt,
      gameId: context.gameId,
      newUnlockCount,
      playerCount: uniquePlayerIds.length,
      reason: context.reason,
    });
    return true;
  } catch (error) {
    console.error("Achievement refresh failed", {
      ...buildAchievementErrorLog(error),
      durationMs: Date.now() - startedAt,
      gameId: context.gameId,
      playerCount: uniquePlayerIds.length,
      reason: context.reason,
    });
    return false;
  }
}

export function scheduleAchievementRefresh(
  groupId: string,
  groupPlayerIds: string[],
  context: AchievementRefreshContext,
): void {
  const uniquePlayerIds = [...new Set(groupPlayerIds)];
  if (uniquePlayerIds.length === 0) return;

  waitUntil((async () => {
    await markAchievementsDirtyBestEffort(groupId, uniquePlayerIds, context);
    await refreshAchievementsBestEffort(groupId, uniquePlayerIds, context);
  })());
}

export async function getPlayerAchievementCollection(
  groupId: string,
  groupPlayerId: string,
): Promise<PlayerAchievementCollection> {
  let collection = await listPlayerAchievementCollection(groupId, groupPlayerId);
  if (collection.needsRefresh) {
    const refreshed = await refreshAchievementsBestEffort(
      groupId,
      [groupPlayerId],
      { reason: "collection-repair" },
    );
    if (refreshed) {
      collection = await listPlayerAchievementCollection(groupId, groupPlayerId);
    }
  }
  const { needsRefresh: _needsRefresh, ...publicCollection } = collection;
  return {
    ...publicCollection,
    items: publicCollection.items.map((achievement) =>
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
