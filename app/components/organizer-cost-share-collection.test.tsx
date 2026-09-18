import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import {
  applyGameCostShareReceiptReceivedAt,
  buildGameCostShareReceiptPath,
  OrganizerCostShareCollection,
} from "./organizer-cost-share-collection";

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

  it("開催詳細から会費保存先を組み立て、対象者だけを即時更新する", () => {
    expect(
      buildGameCostShareReceiptPath("/g/river-check/games/game-1"),
    ).toBe("/g/river-check/games/game-1/cost-share-receipts");
    expect(buildGameCostShareReceiptPath("/g/river-check")).toBeNull();

    const next = applyGameCostShareReceiptReceivedAt(
      [
        receipt("a", "Alice", 500, null),
        receipt("b", "Bob", 1_000, null),
      ],
      "a",
      "2026-08-29T01:00:00.000Z",
    );
    expect(next.map(({ receivedAt }) => receivedAt)).toEqual([
      "2026-08-29T01:00:00.000Z",
      null,
    ]);
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
