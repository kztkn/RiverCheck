import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { LiveTableMini, TableNow } from "../components/table-now";

describe("LIVE TABLE presentation", () => {
  it("0件のイベントは表示せず参加人数だけを表示する", () => {
    const markup = renderToStaticMarkup(
      createElement(TableNow, {
        data: {
          allInCount: 0,
          bombPotCount: 0,
          playerCount: 6,
          sevenDeuceCount: 0,
        },
      }),
    );

    expect(markup).toContain("LIVE TABLE");
    expect(markup).toContain("6");
    expect(markup).toContain("PLAYERS");
    expect(markup).not.toContain("ALL IN");
    expect(markup).not.toContain("BOMB POT");
    expect(markup).not.toContain("72o");
  });

  it("開催一覧のmini表示は記録のあるイベントだけを詳細へリンクする", () => {
    const markup = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(LiveTableMini, {
          data: {
            allInCount: 2,
            bombPotCount: 0,
            playerCount: 5,
            sevenDeuceCount: 1,
          },
          to: "/g/river-check/games/game-1",
        }),
      ),
    );

    expect(markup).toContain('href="/g/river-check/games/game-1"');
    expect(markup).toContain("LIVE TABLE");
    expect(markup).toContain(">5</strong>");
    expect(markup).toContain("PLAYERS");
    expect(markup).toContain(">2</strong>");
    expect(markup).toContain("ALL IN");
    expect(markup).toContain("72o");
    expect(markup).toContain("テーブルに戻る");
    expect(markup).not.toContain("BOMB POT");
  });
});
