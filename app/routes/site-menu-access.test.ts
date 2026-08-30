import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import { GroupSiteMenu } from "~/components/site-menu";

function renderMenu(props = {}) {
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
  return renderToStaticMarkup(createElement(RouterProvider, { router }));
}

describe("group site menu access", () => {
  it("未認証状態ではプレイヤー選択導線を表示しない", () => {
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
    expect(html).toContain("/g/river-check/stats/33333333-3333-4333-8333-333333333333");
  });
});
