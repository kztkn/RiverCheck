import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildTableEventsPath,
  TABLE_EVENT_RECORDER_OPEN_EVENT,
  fetchTableEventPanel,
  TableEventPanelLoadStatus,
  TableEventRecorder,
} from "../components/table-event-recorder";

describe("table event recorder", () => {
  it("開催参加画面だけからtable-events resourceへ接続する", () => {
    expect(buildTableEventsPath("/g/river-check/games/game-1")).toBe(
      "/g/river-check/games/game-1/table-events",
    );
    expect(buildTableEventsPath("/g/river-check/games/game-1/")).toBe(
      "/g/river-check/games/game-1/table-events",
    );
    expect(buildTableEventsPath("/g/river-check/games/game-1/admin")).toBeNull();
    expect(buildTableEventsPath("/g/river-check/games/game-1/admin/edit")).toBeNull();
    expect(buildTableEventsPath("/g/river-check/games/game-1/table-events")).toBeNull();
    expect(TABLE_EVENT_RECORDER_OPEN_EVENT).toBe(
      "rivercheck:open-table-event-recorder",
    );
  });
});

describe("table event panel loading", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("初回取得前でもdialogを描画し、通信成功を開く前提条件にしない", () => {
    const router = createMemoryRouter([
      { path: "/g/:group/games/:game", element: createElement(TableEventRecorder) },
    ], { initialEntries: ["/g/river-check/games/game-1"] });
    const markup = renderToStaticMarkup(createElement(RouterProvider, { router }));
    expect(markup).toContain("<dialog");
    expect(markup).toContain("テーブルイベントを閉じる");
    expect(markup).toContain("読み込み中");
    expect(markup).not.toContain("BOMB POTを記録");
  });

  it("取得失敗後の再試行はGETだけを送り、記録POSTを繰り返さない", async () => {
    const panel = {
      canRecord: true,
      rules: { sevenDeuce: true, bombPot: true },
      participants: [], recentEvents: [],
    };
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(Response.json(panel));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    await expect(fetchTableEventPanel("/table-events", controller.signal)).rejects.toThrow("offline");
    await expect(fetchTableEventPanel("/table-events", controller.signal)).resolves.toEqual(panel);
    for (const [, options] of fetchMock.mock.calls) {
      expect(options.method).toBeUndefined();
      expect(options.signal).toBe(controller.signal);
    }
  });

  it("HTTPエラーやJSONでない応答を読み込み成功として扱わない", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(new Response("<html>sign in</html>")));
    const signal = new AbortController().signal;
    await expect(fetchTableEventPanel("/table-events", signal)).rejects.toThrow();
    await expect(fetchTableEventPanel("/table-events", signal)).rejects.toThrow();
  });

  it("記録不可は通信失敗と区別し、不完全な記録用データは拒否する", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(Response.json({ canRecord: false }))
      .mockResolvedValueOnce(Response.json({ canRecord: true })));
    const signal = new AbortController().signal;
    await expect(fetchTableEventPanel("/table-events", signal)).resolves.toEqual({ canRecord: false });
    await expect(fetchTableEventPanel("/table-events", signal)).rejects.toThrow("応答を確認");
  });

  it.each([
    ["loading", "読み込み中", false],
    ["error", "通信状態を確認", true],
    ["unavailable", "開催の受付状況や参加状態", true],
  ] as const)("%s状態では記録操作ではなく状況と必要な再試行を表示する", (state, copy, retry) => {
    const markup = renderToStaticMarkup(createElement(TableEventPanelLoadStatus, {
      state,
      onRetry: () => undefined,
    }));
    expect(markup).toContain(copy);
    expect(markup.includes("再試行")).toBe(retry);
    expect(markup).not.toContain("BOMB POTを記録");
  });
});
