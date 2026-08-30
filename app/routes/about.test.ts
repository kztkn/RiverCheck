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
  AboutHomeScreenGuide,
  AboutOpenChatSection,
  AboutSections,
} from "./about";

const OPEN_CHAT_URL = "https://line.me/ti/g2/exampleInvite";

describe("about page sections", () => {
  it("OpenChat URL設定時は01〜05の後にコミュニティ導線を置く", () => {
    const markup = renderToStaticMarkup(
      createElement(AboutSections, { lineOpenChatUrl: OPEN_CHAT_URL }),
    );

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

  it("OpenChat URL未設定時はコミュニティ導線を表示しない", () => {
    const markup = renderToStaticMarkup(
      createElement(AboutSections, { lineOpenChatUrl: null }),
    );

    expect(markup).not.toContain("LINE OPENCHAT");
    expect(markup).not.toContain("LINEオープンチャットに参加");
    expect(markup).toContain("ホーム画面に追加する");
  });

  it("設定されたLINEオープンチャットへ案内する", () => {
    const markup = renderToStaticMarkup(
      createElement(AboutOpenChatSection, { url: OPEN_CHAT_URL }),
    );

    expect(markup).toContain("次の開催も、ここから。");
    expect(markup).toContain(`href="${OPEN_CHAT_URL}"`);
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
