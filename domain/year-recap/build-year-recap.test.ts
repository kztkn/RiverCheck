import { describe, expect, it } from "vitest";
import { buildYearRecap, getTokyoYearRange } from "./build-year-recap";
import type { YearRecapResultSource } from "../../types/year-recap";

const results: YearRecapResultSource[] = [
  game("game-1", "player-1", "かずと", 2, 35, 1),
  game("game-1", "player-2", "岩田", 1, 80, 0),
  game("game-1", "player-3", "ひろ", 3, -115, 2),
  game("game-2", "player-1", "かずと", 1, 120, 0),
  game("game-2", "player-2", "岩田", 2, -40, 1),
  game("game-2", "player-3", "ひろ", 3, -80, 0),
  game("game-3", "player-2", "岩田", 1, 30, 0),
  game("game-3", "player-3", "ひろ", 2, -30, 0),
];

describe("buildYearRecap", () => {
  it("グループと本人の年間ハイライトを既存結果から組み立てる", () => {
    const recap = buildYearRecap({
      year: 2026,
      groupPlayerId: "player-1",
      displayName: "かずと",
      avatarUpdatedAt: null,
      results,
      stories: { postsCreated: 2, reactionsReceived: 5, reactedPostCount: 3 },
      achievements: [],
    });

    expect(recap.group).toMatchObject({
      gamesPlayed: 3,
      totalEntries: 8,
      uniquePlayers: 3,
      totalRebuys: 4,
    });
    expect(recap.group.mostActivePlayer).toMatchObject({
      displayName: "ひろ",
      value: 3,
    });
    expect(recap.group.mostWinsPlayer).toMatchObject({
      displayName: "岩田",
      value: 2,
    });
    expect(recap.player).toMatchObject({
      gamesPlayed: 2,
      wins: 1,
      topThreeFinishes: 2,
      totalNetBb: 155,
      totalRebuys: 1,
    });
    expect(recap.player.attendanceRate).toBeCloseTo(66.67, 1);
    expect(recap.player.bestGame).toMatchObject({ gameId: "game-2", netBb: 120 });
    expect(recap.player.tableMate).toMatchObject({ displayName: "ひろ", value: 2 });
  });

  it("結果がない年も0件のサマリーを返す", () => {
    const recap = buildYearRecap({
      year: 2026,
      groupPlayerId: "player-1",
      displayName: "かずと",
      avatarUpdatedAt: null,
      results: [],
      stories: { postsCreated: 0, reactionsReceived: 0, reactedPostCount: 0 },
      achievements: [],
    });

    expect(recap.group.gamesPlayed).toBe(0);
    expect(recap.player.attendanceRate).toBe(0);
    expect(recap.player.bestGame).toBeNull();
    expect(recap.player.tableMate).toBeNull();
  });

  it("全開催がマイナスなら最大プラス開催を作らない", () => {
    const recap = buildYearRecap({
      year: 2026,
      groupPlayerId: "player-1",
      displayName: "かずと",
      avatarUpdatedAt: null,
      results: [game("game-1", "player-1", "かずと", 2, -10, 0)],
      stories: { postsCreated: 0, reactionsReceived: 0, reactedPostCount: 0 },
      achievements: [],
    });

    expect(recap.player.bestGame).toBeNull();
  });
});

describe("getTokyoYearRange", () => {
  it("日本時間の年初と翌年年初をUTCへ変換する", () => {
    expect(getTokyoYearRange(2026)).toEqual({
      startAt: "2025-12-31T15:00:00.000Z",
      endAt: "2026-12-31T15:00:00.000Z",
    });
  });
});

function game(
  gameId: string,
  groupPlayerId: string,
  displayName: string,
  rank: number,
  netBb: number,
  totalRebuyCount: number,
): YearRecapResultSource {
  return {
    gameId,
    gameTitle: gameId,
    playedAt: `2026-0${gameId.at(-1)}-01T10:00:00.000Z`,
    groupPlayerId,
    displayName,
    avatarUpdatedAt: null,
    rank,
    totalRebuyCount,
    netBb,
  };
}
