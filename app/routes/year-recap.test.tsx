import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { YearRecapSummary } from "@shared-types/year-recap";

const mocked = vi.hoisted(() => ({
  getAuthenticatedPlayerProfile: vi.fn(),
  getYearRecap: vi.fn(),
}));

vi.mock("@server/services/player-profile-service.server", () => ({
  getAuthenticatedPlayerProfile: mocked.getAuthenticatedPlayerProfile,
}));
vi.mock("@server/services/year-recap-service.server", () => ({
  getYearRecap: mocked.getYearRecap,
}));

import { buildSlides, loader } from "./year-recap";

const recap: YearRecapSummary = {
  year: 2026,
  group: {
    gamesPlayed: 4,
    totalEntries: 18,
    uniquePlayers: 6,
    totalRebuys: 8,
    mostActivePlayer: {
      groupPlayerId: "player-2",
      displayName: "岩田",
      avatarUpdatedAt: null,
      value: 4,
    },
    mostWinsPlayer: {
      groupPlayerId: "player-2",
      displayName: "岩田",
      avatarUpdatedAt: null,
      value: 2,
    },
  },
  player: {
    groupPlayerId: "player-1",
    displayName: "かずと",
    avatarUpdatedAt: null,
    gamesPlayed: 3,
    attendanceRate: 75,
    wins: 1,
    topThreeFinishes: 2,
    totalNetBb: 155,
    totalRebuys: 2,
    bestGame: {
      gameId: "game-1",
      gameTitle: "9月ポーカー会",
      playedAt: "2026-09-20T10:00:00.000Z",
      rank: 1,
      netBb: 120,
    },
    tableMate: {
      groupPlayerId: "player-2",
      displayName: "岩田",
      avatarUpdatedAt: null,
      value: 3,
    },
  },
  stories: { postsCreated: 2, reactionsReceived: 5, reactedPostCount: 3 },
  achievements: [
    {
      id: "achievement-1",
      name: "初優勝",
      iconKey: "trophy",
      unlockedAt: "2026-09-20T10:00:00.000Z",
    },
  ],
};

describe("year recap loader", () => {
  beforeEach(() => vi.resetAllMocks());

  it("本人プロフィールの2026年まとめだけを返す", async () => {
    const profile = {
      groupPlayerId: "player-1",
      displayName: "かずと",
    };
    mocked.getAuthenticatedPlayerProfile.mockResolvedValue({
      group: { id: "group-1", name: "River Check", publicCode: "river-check" },
      profile,
    });
    mocked.getYearRecap.mockResolvedValue(recap);

    const result = await loader({
      request: new Request("https://example.com/g/river-check/recap/2026"),
      params: { groupCode: "river-check" },
      context: {},
    } as never);

    expect(mocked.getYearRecap).toHaveBeenCalledWith("group-1", profile, 2026);
    expect(result).toMatchObject({ recap, group: { publicCode: "river-check" } });
  });

  it("本人プロフィールがない端末には公開しない", async () => {
    mocked.getAuthenticatedPlayerProfile.mockResolvedValue({
      group: { id: "group-1", name: "River Check", publicCode: "river-check" },
      profile: null,
    });

    await expect(
      loader({
        request: new Request("https://example.com/g/river-check/recap/2026"),
        params: { groupCode: "river-check" },
        context: {},
      } as never),
    ).rejects.toMatchObject({ status: 403 });
    expect(mocked.getYearRecap).not.toHaveBeenCalled();
  });
});

describe("year recap slides", () => {
  it("年間の主要記録を自動送り用スライドへ展開する", () => {
    const slides = buildSlides(recap, "river-check");
    const markup = renderToStaticMarkup(
      createElement(Fragment, null, ...slides.map((slide) => slide.content)),
    );

    expect(slides[0]?.key).toBe("cover");
    expect(slides.at(-1)?.key).toBe("finale");
    expect(markup).toContain("かずとの");
    expect(markup).toContain("<strong>4</strong><span>開催</span>");
    expect(markup).toContain("+155BB");
    expect(markup).toContain("9月ポーカー会");
    expect(markup).toContain("もっとも多く同卓したのは");
    expect(markup).toContain("TABLE STORIES");
    expect(markup).toContain("初優勝");
  });

  it("開催がない年は空状態と締めだけを表示する", () => {
    const slides = buildSlides({
      ...recap,
      group: {
        gamesPlayed: 0,
        totalEntries: 0,
        uniquePlayers: 0,
        totalRebuys: 0,
        mostActivePlayer: null,
        mostWinsPlayer: null,
      },
      player: {
        ...recap.player,
        gamesPlayed: 0,
        attendanceRate: 0,
        wins: 0,
        topThreeFinishes: 0,
        totalNetBb: 0,
        totalRebuys: 0,
        bestGame: null,
        tableMate: null,
      },
      stories: { postsCreated: 0, reactionsReceived: 0, reactedPostCount: 0 },
      achievements: [],
    }, "river-check");

    expect(slides.map((slide) => slide.key)).toEqual(["cover", "empty", "finale"]);
  });
});
