import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { GroupSiteMenu } from "./site-menu";

function renderMenu(
  props: Partial<Parameters<typeof GroupSiteMenu>[0]> = {},
): string {
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(GroupSiteMenu, {
        groupCode: "river-check",
        ...props,
      }),
    ),
  );
}

describe("GroupSiteMenu", () => {
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
