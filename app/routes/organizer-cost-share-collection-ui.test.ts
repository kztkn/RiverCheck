import { describe, expect, it } from "vitest";
import {
  applyGameCostShareReceiptReceivedAt,
  buildGameCostShareReceiptPath,
} from "~/components/organizer-cost-share-collection";

const receipts = [
  {
    costShare: 1_500,
    displayName: "Alice",
    groupPlayerId: "player-1",
    receivedAt: null,
  },
  {
    costShare: 1_500,
    displayName: "Bob",
    groupPlayerId: "player-2",
    receivedAt: null,
  },
];

describe("organizer cost share collection optimistic UI", () => {
  it("開催詳細から会費保存用resource routeを組み立てる", () => {
    expect(
      buildGameCostShareReceiptPath("/g/river-check/games/game-1"),
    ).toBe("/g/river-check/games/game-1/cost-share-receipts");
    expect(buildGameCostShareReceiptPath("/g/river-check")).toBeNull();
  });

  it("対象者だけを即時に受取済みへ更新できる", () => {
    const next = applyGameCostShareReceiptReceivedAt(
      receipts,
      "player-1",
      "2026-08-29T01:00:00.000Z",
    );

    expect(next[0]?.receivedAt).toBe("2026-08-29T01:00:00.000Z");
    expect(next[1]?.receivedAt).toBeNull();
  });
});
