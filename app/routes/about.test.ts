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
  ABOUT_DESCRIPTION,
  AboutGuide,
  AboutHomeScreenGuide,
  AboutOpenChatSection,
  AboutSections,
  LINE_OPEN_CHAT_URL,
} from "./about";

describe("about page sections", () => {
  it("案内文ではグループ名を付けず、オープンチャットを01〜05の後に置く", () => {
    const markup = renderToStaticMarkup(createElement(AboutSections));

    expect(ABOUT_DESCRIPTION).toBe(
      "開催結果、会費の精算、個人戦績をひとつにまとめるポーカー会向けWebアプリです。",
    );
    expect(markup.indexOf("称号を集める")).toBeLessThan(
      markup.indexOf("LINE OPENCHAT"),
    );
    expect(markup.indexOf("LINE OPENCHAT")).toBeLessThan(
      markup.indexOf("ホーム画面に追加する"),
    );
    expect(markup).toContain("プロフィール画面で自分の名前を選ぶ");
    expect(markup).not.toContain("本人用リンク");
  });

  it("開催通知・当日連絡用のLINEオープンチャットへ案内する", () => {
    const markup = renderToStaticMarkup(createElement(AboutOpenChatSection));

    expect(markup).toContain("次の開催も、ここから。");
    expect(markup).toContain(`href="${LINE_OPEN_CHAT_URL}"`);
    expect(markup).toContain("LINEオープンチャットに参加");
    expect(markup).not.toContain("↗");
  });

  it("ホーム画面追加手順を初期状態では閉じて表示する", () => {
    const markup = renderToStaticMarkup(createElement(AboutHomeScreenGuide));

    expect(markup).toContain("<details");
    expect(markup).not.toMatch(/<details[^>]*\sopen(?:=|\s|>)/u);
    expect(markup).toContain("ホーム画面に追加する");
    expect(markup).toContain("ホーム画面に追加");
  });
});
