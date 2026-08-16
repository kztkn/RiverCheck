import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import {
  PlayerGameHistory,
  PlayerStatsOverview,
} from "../components/player-stats-detail";
import {
  PlayerAchievementCollectionView,
} from "../components/player-achievement-collection";
import type { PlayerStatsSummary } from "@shared-types/player-stats";
import type { PlayerAchievementCollection } from "@shared-types/achievement";

const summary: PlayerStatsSummary = {
  groupPlayerId: "11111111-1111-4111-8111-111111111111",
  displayName: "Alice",
  profileMessage: "次も楽しむ",
  favoriteCard1: "AS",
  favoriteCard2: "KH",
  avatarUpdatedAt: null,
  gamesPlayed: 12,
  wins: 3,
  winRate: 25,
  averageRank: 2.5,
  totalNetBb: 298,
  averageNetBb: 24.83,
  maxWinBb: 142,
  maxLossBb: -86,
};

describe("PlayerStatsOverview", () => {
  it("makes total profit the primary metric and keeps supporting stats", () => {
    const markup = renderToStaticMarkup(
      createElement(PlayerStatsOverview, { summary }),
    );

    expect(markup).toContain("TOTAL PROFIT");
    expect(markup).toContain("+298BB");
    expect(markup).not.toContain("累計損益BB");
    expect(markup).toContain("参加回数");
    expect(markup).toContain("12回");
    expect(markup).toContain("優勝回数");
    expect(markup).toContain("3回");
    expect(markup).toContain("優勝率");
    expect(markup).toContain("25%");
    expect(markup).toContain("平均順位");
    expect(markup).toContain("2.5");
    expect(markup).toContain("平均損益");
    expect(markup).toContain("+24.83BB");
    expect(markup).toContain("最大勝ち");
    expect(markup).toContain("+142BB");
    expect(markup).toContain("最大負け");
    expect(markup).toContain("-86BB");
    expect(markup).not.toContain("stats-kpi-card");
  });

  it("shows an em dash for average rank before the first game", () => {
    const markup = renderToStaticMarkup(
      createElement(PlayerStatsOverview, {
        summary: { ...summary, averageRank: 0, gamesPlayed: 0 },
      }),
    );

    expect(markup).toContain("平均順位");
    expect(markup).toContain("—");
  });
});

describe("PlayerGameHistory", () => {
  it("keeps every existing result field and game link in a light list row", () => {
    const markup = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        { initialEntries: ["/"] },
        createElement(PlayerGameHistory, {
          groupCode: "river-check",
          games: [
            {
              gameId: "22222222-2222-4222-8222-222222222222",
              gameTitle: "第3回ポーカー会 桜木町",
              playedAt: "2026-08-07T12:00:00.000Z",
              rank: 1,
              totalRebuyCount: 2,
              settlementRebuyCount: 1,
              netBb: 42,
              cumulativeNetBb: 298,
            },
          ],
        }),
      ),
    );

    expect(markup).toContain("開催履歴");
    expect(markup).toContain("8.07");
    expect(markup).toContain("1st");
    expect(markup).toContain("第3回ポーカー会 桜木町");
    expect(markup).toContain("Rebuy 2回");
    expect(markup).toContain("終了時未返済 1口");
    expect(markup).toContain("+42BB");
    expect(markup).toContain(
      "/g/river-check/games/22222222-2222-4222-8222-222222222222",
    );
    expect(markup).toContain("stats-game-row");
    expect(markup).not.toContain("stats-game-card");
  });
});

describe("PlayerAchievementCollectionView", () => {
  it("shows equipped and other unlocked titles first, then keeps locked titles collapsed", () => {
    const collection: PlayerAchievementCollection = {
      unlockedCount: 2,
      totalCount: 4,
      equippedAchievement: {
        id: "equipped",
        code: "first-crown",
        name: "初戴冠",
        description: "初めて優勝する",
        iconKey: "trophy",
        category: "rank",
      },
      items: [
        {
          id: "other",
          code: "regular",
          name: "常連",
          description: "5開催に参加する",
          iconKey: "calendar-check",
          category: "participation",
          isHidden: false,
          isUnlocked: true,
          isEquipped: false,
          unlockedAt: "2026-08-02T12:00:00.000Z",
          sourceGame: null,
        },
        {
          id: "locked",
          code: "profit",
          name: "BB長者",
          description: "累計+500BB",
          iconKey: "trending-up",
          category: "profit",
          isHidden: false,
          isUnlocked: false,
          isEquipped: false,
          unlockedAt: null,
          sourceGame: null,
        },
        {
          id: "equipped",
          code: "first-crown",
          name: "初戴冠",
          description: "初めて優勝する",
          iconKey: "trophy",
          category: "rank",
          isHidden: false,
          isUnlocked: true,
          isEquipped: true,
          unlockedAt: "2026-08-01T12:00:00.000Z",
          sourceGame: {
            id: "game-1",
            title: "第1回ポーカー会",
            playedAt: "2026-08-01T12:00:00.000Z",
          },
        },
        {
          id: "hidden",
          code: "secret",
          name: "秘密の称号",
          description: "秘密の条件",
          iconKey: "badge-check",
          category: "record",
          isHidden: true,
          isUnlocked: false,
          isEquipped: false,
          unlockedAt: null,
          sourceGame: null,
        },
      ],
    };
    const markup = renderAchievementCollection(collection);

    expect(markup).toContain("achievement-unlocked-grid");
    expect(markup.indexOf("初戴冠")).toBeLessThan(markup.indexOf("常連"));
    expect(markup).toContain("装備中");
    expect(markup).toContain("第1回ポーカー会");
    expect(markup).not.toContain("/games/game-1");
    expect(markup).toContain("<details");
    expect(markup).toContain("未獲得");
    expect(markup).toContain("すべて見る");
    expect(markup).toContain("BB長者");
    expect(markup).toContain("条件は秘密");
    expect(markup).not.toContain("秘密の称号");
    expect(markup).not.toContain("横にスワイプ");
    expect(markup).not.toContain("achievement-collection-rail");
  });

  it("keeps zero and twenty-title collections structurally compact", () => {
    const emptyMarkup = renderAchievementCollection({
      unlockedCount: 0,
      totalCount: 0,
      equippedAchievement: null,
      items: [],
    });
    expect(emptyMarkup).toContain("まだ獲得した称号はありません");
    expect(emptyMarkup).not.toContain("<details");

    const lockedItems = Array.from({ length: 20 }, (_, index) => ({
      id: `locked-${index}`,
      code: `locked-${index}`,
      name: `未獲得称号${index + 1}`,
      description: "獲得条件",
      iconKey: "badge-check" as const,
      category: "record",
      isHidden: false,
      isUnlocked: false,
      isEquipped: false,
      unlockedAt: null,
      sourceGame: null,
    }));
    const largeMarkup = renderAchievementCollection({
      unlockedCount: 0,
      totalCount: 20,
      equippedAchievement: null,
      items: lockedItems,
    });
    expect(largeMarkup).toContain("未獲得 <strong>20</strong>");
    expect(largeMarkup.match(/data-achievement-category/g)).toHaveLength(20);
    expect(largeMarkup.match(/<details/g)).toHaveLength(1);
  });
});

function renderAchievementCollection(collection: PlayerAchievementCollection) {
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: ["/"] },
      createElement(PlayerAchievementCollectionView, {
        collection,
      }),
    ),
  );
}
