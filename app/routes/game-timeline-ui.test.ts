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

  it("リバイと返済を初期折りたたみの時系列として表示する", () => {
    const markup = renderToStaticMarkup(
      createElement(GameTimelineView, {
        events: [
          {
            avatarUrl: null,
            displayName: "Alice",
            id: "1",
            recordedAt: "2026-08-28T10:42:00.000Z",
            type: "rebuy" as const,
          },
          {
            avatarUrl: null,
            displayName: "Bob",
            id: "2",
            recordedAt: "2026-08-28T11:07:00.000Z",
            type: "repayment" as const,
          },
        ],
      }),
    );

    expect(markup).toContain("<details");
    expect(markup).toContain("<summary");
    expect(markup).not.toContain("<details open");
    expect(markup).toContain("GAME TIMELINE");
    expect(markup).toContain("リバイと返済の記録");
    expect(markup).toContain("2件");
    expect(markup).toContain("19:42");
    expect(markup).toContain("20:07");
    expect(markup).toContain("Alice");
    expect(markup).toContain("Bob");
    expect(markup).toContain("リバイ");
    expect(markup).toContain("100BB返済");
    expect(markup).not.toContain("🔥");
    expect(markup).not.toContain("💸");
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
