import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  buildGameTimelinePath,
  GameTimelineView,
} from "../components/game-timeline";

describe("game timeline", () => {
  it("イベント0件ではセクションを表示しない", () => {
    expect(
      renderToStaticMarkup(createElement(GameTimelineView, { events: [] })),
    ).toBe("");
  });

  it("運営記録と卓イベントを1本のタイムラインへ表示する", () => {
    const markup = renderToStaticMarkup(
      createElement(GameTimelineView, {
        events: [
          {
            avatarUrl: null,
            displayName: "Alice",
            groupPlayerId: "player-1",
            id: "1",
            recordedAt: "2026-08-28T10:42:00.000Z",
            type: "rebuy" as const,
          },
          {
            id: "2",
            recordedAt: "2026-08-28T11:00:00.000Z",
            type: "seven_deuce" as const,
            subject: {
              avatarUrl: null,
              displayName: "Bob",
              groupPlayerId: "player-2",
            },
            players: [] as [],
          },
          {
            id: "3",
            recordedAt: "2026-08-28T11:07:00.000Z",
            type: "all_in" as const,
            subject: null,
            players: [
              { groupPlayerId: "player-1", displayName: "Alice", isWinner: true },
              { groupPlayerId: "player-2", displayName: "Bob", isWinner: false },
            ],
          },
        ],
      }),
    );

    expect(markup).toContain("<details");
    expect(markup).not.toContain("<details open");
    expect(markup).toContain("GAME TIMELINE");
    expect(markup).toContain("今日の卓の記録");
    expect(markup).toContain("3件");
    expect(markup).toContain("Alice");
    expect(markup).toContain("リバイ");
    expect(markup).toContain("72o成立");
    expect(markup).toContain("Bob");
    expect(markup).toContain("ALL IN");
    expect(markup).toContain("Alice WIN");
  });

  it("ALL IN敗者の3分以内のリバイをALL INの続きとして表示する", () => {
    const markup = renderToStaticMarkup(
      createElement(GameTimelineView, {
        events: [
          {
            id: "all-in",
            recordedAt: "2026-08-28T11:07:00.000Z",
            type: "all_in" as const,
            subject: null,
            players: [
              { groupPlayerId: "a", displayName: "Alice", isWinner: true },
              { groupPlayerId: "b", displayName: "Bob", isWinner: false },
            ],
          },
          {
            avatarUrl: null,
            displayName: "Bob",
            groupPlayerId: "b",
            id: "rebuy",
            recordedAt: "2026-08-28T11:08:00.000Z",
            type: "rebuy" as const,
          },
        ],
      }),
    );

    expect(markup).toContain("↳ Bob リバイ");
  });

  it("表示中の開催URLから開催ごとのtimeline URLを組み立てる", () => {
    expect(buildGameTimelinePath("/g/river/games/game-1")).toBe(
      "/g/river/games/game-1/timeline",
    );
    expect(buildGameTimelinePath("/g/river/games/game-2/")).toBe(
      "/g/river/games/game-2/timeline",
    );
  });
});
