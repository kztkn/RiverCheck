import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import { OrganizerCostShareCollection } from "./organizer-cost-share-collection";

describe("OrganizerCostShareCollection", () => {
  it("回収数、未回収数、0円の対象外を表示する", () => {
    const router = createMemoryRouter([
      {
        path: "/",
        element: createElement(OrganizerCostShareCollection, {
          receipts: [
            receipt("a", "Alice", 0, null),
            receipt("b", "Bob", 500, "2026-08-29T10:00:00.000Z"),
            receipt("c", "Carol", 1_000, null),
          ],
        }),
      },
    ]);

    const markup = renderToStaticMarkup(
      createElement(RouterProvider, { router }),
    );

    expect(markup).toContain("会費の回収");
    expect(markup).toContain("未回収 1人");
    expect(markup).toContain("1 / 2人");
    expect(markup).toContain("対象外");
    expect(markup).toContain("主催者だけに表示されます");
  });

  it("全対象者を確認済みにすると回収完了を表示する", () => {
    const router = createMemoryRouter([
      {
        path: "/",
        element: createElement(OrganizerCostShareCollection, {
          receipts: [
            receipt("a", "Alice", 500, "2026-08-29T10:00:00.000Z"),
            receipt("b", "Bob", 1_000, "2026-08-29T10:01:00.000Z"),
          ],
        }),
      },
    ]);

    const markup = renderToStaticMarkup(
      createElement(RouterProvider, { router }),
    );

    expect(markup).toContain("回収完了");
    expect(markup).toContain("2 / 2人");
  });
});

function receipt(
  groupPlayerId: string,
  displayName: string,
  costShare: number,
  receivedAt: string | null,
) {
  return { costShare, displayName, groupPlayerId, receivedAt };
}
