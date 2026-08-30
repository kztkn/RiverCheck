import { describe, expect, it } from "vitest";
import { orderActiveGamesBySchedule } from "./order-active-games";

type TestGame = {
  id: string;
  playedAt: string;
  status: "draft" | "open" | "finalized";
};

function game(
  id: string,
  playedAt: string,
  status: TestGame["status"] = "open",
): TestGame {
  return { id, playedAt, status };
}

describe("orderActiveGamesBySchedule", () => {
  it("今日以降は近い開催日から並べる", () => {
    const result = orderActiveGamesBySchedule(
      [
        game("later", "2026-09-20T15:00:00.000Z"),
        game("next", "2026-08-31T15:00:00.000Z"),
        game("middle", "2026-09-05T15:00:00.000Z"),
      ],
      new Date("2026-08-30T11:00:00.000Z"),
    );

    expect(result.map((item) => item.id)).toEqual(["next", "middle", "later"]);
  });

  it("未来開催を優先し、日付超過の未終了開催は後ろで新しい順に残す", () => {
    const result = orderActiveGamesBySchedule(
      [
        game("old", "2026-08-01T15:00:00.000Z"),
        game("future", "2026-09-05T15:00:00.000Z"),
        game("recent-overdue", "2026-08-28T15:00:00.000Z"),
        game("finalized", "2026-08-31T15:00:00.000Z", "finalized"),
      ],
      new Date("2026-08-30T11:00:00.000Z"),
    );

    expect(result.map((item) => item.id)).toEqual([
      "future",
      "recent-overdue",
      "old",
    ]);
  });

  it("未来開催がなければ直近の日付超過開催を先頭にする", () => {
    const result = orderActiveGamesBySchedule(
      [
        game("older", "2026-08-01T15:00:00.000Z"),
        game("closest", "2026-08-29T15:00:00.000Z"),
      ],
      new Date("2026-08-30T11:00:00.000Z"),
    );

    expect(result.map((item) => item.id)).toEqual(["closest", "older"]);
  });
});
