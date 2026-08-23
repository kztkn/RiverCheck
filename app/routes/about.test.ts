import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@server/repositories/group-repository.server", () => ({
  findGroupByPublicCode: vi.fn(),
}));
vi.mock("~/components/site-menu", () => ({
  GroupSiteHeader: vi.fn(() => null),
}));
import {
  AboutHomeScreenGuide,
  AboutOpenChatCard,
  LINE_OPEN_CHAT_URL,
} from "./about";

describe("about page sections", () => {
  it("開催通知・当日連絡用のLINEオープンチャットへ案内する", () => {
    const markup = renderToStaticMarkup(createElement(AboutOpenChatCard));

    expect(markup).toContain("開催通知・当日の連絡");
    expect(markup).toContain(`href="${LINE_OPEN_CHAT_URL}"`);
    expect(markup).toContain("オープンチャットを開く");
  });

  it("ホーム画面追加手順を初期状態では閉じて表示する", () => {
    const markup = renderToStaticMarkup(createElement(AboutHomeScreenGuide));

    expect(markup).toContain("<details");
    expect(markup).not.toMatch(/<details[^>]*\sopen(?:=|\s|>)/u);
    expect(markup).toContain("ホーム画面に追加する");
    expect(markup).toContain("ホーム画面に追加");
  });
});
