import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GameTimelineView } from "../components/game-timeline";

describe("game timeline", () => {
  it("イベント0件ではセクションを表示しない", () => {
    expect(
      renderToStaticMarkup(createElement(GameTimelineView, { events: [] })),
    ).toBe("");
  });

  it("リバイと返済を絵文字なしの時系列として表示する", () => {
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

    expect(markup).toContain("GAME TIMELINE");
    expect(markup).toContain("リバイと返済の記録");
    expect(markup).toContain("19:42");
    expect(markup).toContain("20:07");
    expect(markup).toContain("Alice");
    expect(markup).toContain("Bob");
    expect(markup).toContain("リバイ");
    expect(markup).toContain("100BB返済");
    expect(markup).not.toContain("🔥");
    expect(markup).not.toContain("💸");
  });
});
