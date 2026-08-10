import { evaluateAchievements } from "@domain/achievement/evaluate-achievements";
import {
  insertAchievementUnlocks,
  listAchievementHistoryGames,
  listPlayerAchievementCollection,
  listUnlockedAchievementIds,
} from "@server/repositories/achievement-repository.server";
import type { DatabaseTransaction } from "@server/db/client.server";
import type { PlayerAchievementCollection } from "@shared-types/achievement";

export async function awardAchievementsForPlayers(
  transaction: DatabaseTransaction,
  groupId: string,
  groupPlayerIds: string[],
): Promise<void> {
  const uniquePlayerIds = [...new Set(groupPlayerIds)];
  const history = await listAchievementHistoryGames(
    transaction,
    groupId,
    uniquePlayerIds,
  );

  for (const groupPlayerId of uniquePlayerIds) {
    const games = history
      .filter((game) => game.groupPlayerId === groupPlayerId)
      .map((game) => ({
        gameId: game.gameId,
        rank: game.rank,
        netBb: game.netBb,
      }));
    await insertAchievementUnlocks(
      transaction,
      groupId,
      groupPlayerId,
      evaluateAchievements(games),
    );
  }
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
