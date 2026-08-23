import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GameStories } from "../components/game-stories";

describe("GameStories", () => {
  it("参加者投稿を投稿時刻順で表示する", () => {
    const markup = renderToStaticMarkup(
      createElement(GameStories, {
        initialChips: 20_000,
        isOrganizer: false,
        posts: [
          {
            avatarUpdatedAt: null,
            avatarUrl: null,
            body: "リバーのチョップが面白かった！",
            createdAt: "2026-08-22T00:00:00.000Z",
            displayName: "Alice",
            groupPlayerId: "33333333-3333-4333-8333-333333333333",
            id: "55555555-5555-4555-8555-555555555555",
            photo: null,
            photoUrl: null,
            updatedAt: "2026-08-23T00:00:00.000Z",
          },
          {
            avatarUpdatedAt: null,
            avatarUrl: null,
            body: "今日のベストハンド",
            createdAt: "2026-08-23T00:00:00.000Z",
            displayName: "Kazuto",
            groupPlayerId: "77777777-7777-4777-8777-777777777777",
            id: "88888888-8888-4888-8888-888888888888",
            photo: null,
            photoUrl: null,
            updatedAt: "2026-08-23T00:00:00.000Z",
          },
        ],
        results: [
          {
            costShare: 0,
            displayName: "Alice",
            groupPlayerId: "33333333-3333-4333-8333-333333333333",
            rank: 1,
            remainingChips: 30_000,
            score: 30_000,
            settlementRebuyCount: 0,
            totalRebuyCount: 0,
            trackedOutstandingRebuyCount: 0,
          },
        ],
      }),
    );

    expect(markup).toContain("TABLE STORIES");
    expect(markup.indexOf("リバーのチョップが面白かった！")).toBeLessThan(
      markup.indexOf("今日のベストハンド"),
    );
    expect(markup).toContain("Alice");
    expect(markup).toContain("1st ・ +50BB");
  });

  it("投稿がない場合はセクションを表示しない", () => {
    const markup = renderToStaticMarkup(
      createElement(GameStories, {
        initialChips: 20_000,
        isOrganizer: false,
        posts: [],
        results: [],
      }),
    );

    expect(markup).toBe("");
  });
});
