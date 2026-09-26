import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import { buildHeaderProfileUrl, GroupSiteMenu } from "./site-menu";

function renderMenu(
  props: Partial<Parameters<typeof GroupSiteMenu>[0]> = {},
): string {
  const router = createMemoryRouter(
    [
      {
        path: "*",
        element: createElement(GroupSiteMenu, {
          groupCode: "river-check",
          ...props,
        }),
      },
    ],
    { initialEntries: ["/g/river-check"] },
  );
  return renderToStaticMarkup(
    createElement(RouterProvider, { router }),
  );
}

describe("GroupSiteMenu", () => {
  it("未認証状態ではプレイヤー用導線を表示しない", () => {
    const html = renderMenu();

    expect(html).not.toContain("プレイヤーを選択");
    expect(html).not.toContain("/g/river-check/profile");
  });

  it("本人認証済みならプロフィール導線を表示する", () => {
    const html = renderMenu({
      hasPlayer: true,
      groupPlayerId: "33333333-3333-4333-8333-333333333333",
    });

    expect(html).toContain("プロフィール");
    expect(html).toContain(
      "/g/river-check/stats/33333333-3333-4333-8333-333333333333",
    );
    expect(html).not.toContain("/g/river-check/logout");
  });

  it("一般プレイヤーは1グループ所属なら切替導線を表示しない", () => {
    const html = renderMenu({
      groupPlayerId: "33333333-3333-4333-8333-333333333333",
      hasPlayer: true,
      hasMultipleGroups: false,
    });

    expect(html).not.toContain("グループを切り替える");
    expect(html).not.toContain("グループを管理");
  });

  it("複数グループ所属ならプロフィール直下に切替導線を表示する", () => {
    const html = renderMenu({
      groupPlayerId: "33333333-3333-4333-8333-333333333333",
      hasPlayer: true,
      hasMultipleGroups: true,
    });

    expect(html).toContain("グループを切り替える");
    expect(html.indexOf("プロフィール")).toBeLessThan(
      html.indexOf("グループを切り替える"),
    );
    expect(html.indexOf("グループを切り替える")).toBeLessThan(
      html.indexOf("このアプリについて"),
    );
  });

  it("主催者は1グループでも新規作成入口としてグループ管理を表示する", () => {
    const html = renderMenu({ organizer: true });

    expect(html).toContain("グループを管理");
    expect(html).not.toContain("グループを切り替える");
  });
});


describe("buildHeaderProfileUrl", () => {
  it("本人認証済みの通常ヘッダーは自分のプロフィールへ進める", () => {
    expect(
      buildHeaderProfileUrl(
        "river-check",
        "33333333-3333-4333-8333-333333333333",
        false,
      ),
    ).toBe(
      "/g/river-check/stats/33333333-3333-4333-8333-333333333333",
    );
  });

  it("ゲストまたはナビゲーション非表示ではリンクにしない", () => {
    expect(buildHeaderProfileUrl("river-check", null, false)).toBeNull();
    expect(
      buildHeaderProfileUrl(
        "river-check",
        "33333333-3333-4333-8333-333333333333",
        true,
      ),
    ).toBeNull();
  });
});
