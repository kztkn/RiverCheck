import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import { ReusablePlayerPicker } from "~/components/reusable-player-picker";

function renderPicker(): string {
  const router = createMemoryRouter(
    [
      {
        path: "*",
        element: createElement(ReusablePlayerPicker, {
          action: "/g/group-b/players",
          currentMemberCount: 1,
          players: [
            {
              playerId: "11111111-1111-4111-8111-111111111111",
              displayName: "Alice",
              avatarUrl: null,
              hasProfileAccess: true,
              groupNames: ["グループA"],
            },
            {
              playerId: "22222222-2222-4222-8222-222222222222",
              displayName: "Bob",
              avatarUrl: null,
              hasProfileAccess: false,
              groupNames: ["グループA"],
            },
          ],
        }),
      },
    ],
    { initialEntries: ["/g/group-b/players"] },
  );

  return renderToStaticMarkup(createElement(RouterProvider, { router }));
}

describe("ReusablePlayerPicker", () => {
  it("候補ごとにRouter管理のPOSTフォームを描画する", () => {
    const html = renderPicker();

    expect(html.match(/<form/g)).toHaveLength(2);
    expect(html.match(/action="\/g\/group-b\/players"/g)).toHaveLength(2);
    expect(html.match(/method="post"/g)).toHaveLength(2);
    expect(html).toContain('value="11111111-1111-4111-8111-111111111111"');
    expect(html).toContain('value="22222222-2222-4222-8222-222222222222"');
  });
});
