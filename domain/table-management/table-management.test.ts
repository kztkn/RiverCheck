import { describe, expect, it } from "vitest";
import { orderSubTable, subStayMinutes, validateTableAllocation } from "./table-management";
import type { TableSeat } from "../../types/table-management";

describe("卓管理の候補と滞在時間", () => {
  const seats: TableSeat[] = [
    { groupPlayerId: "c", displayName: "笹谷", table: "SUB", subEnteredAt: "2026-10-01T11:42:00Z" },
    { groupPlayerId: "a", displayName: "岩田", table: "SUB", subEnteredAt: "2026-10-01T11:18:00Z" },
    { groupPlayerId: "b", displayName: "ひろ", table: "MAIN", subEnteredAt: null },
  ];
  it("現在サブ卓の最長滞在者から並べ、元の配列は変更しない", () => {
    expect(orderSubTable(seats).map((seat) => seat.displayName)).toEqual(["岩田", "笹谷"]);
    expect(seats[0].displayName).toBe("笹谷");
    expect(subStayMinutes(seats[1].subEnteredAt!, Date.parse("2026-10-01T12:00:59Z"))).toBe(42);
    expect(subStayMinutes(seats[1].subEnteredAt!, Date.parse("2026-10-01T11:00:00Z"))).toBe(0);
  });
  it("同時開始でも更新のたびに候補が入れ替わらない", () => {
    const tied = seats.filter((seat) => seat.table === "SUB").map((seat) => ({ ...seat, subEnteredAt: "2026-10-01T11:00:00Z" }));
    expect(orderSubTable(tied)[0].groupPlayerId).toBe("a");
    expect(orderSubTable(tied.reverse())[0].groupPlayerId).toBe("a");
  });
  it("全参加者を重複なく2卓へ振り分けることを要求する", () => {
    expect(validateTableAllocation(["a", "b", "c"], ["a", "b"], ["c"])).toBe(true);
    expect(validateTableAllocation(["a", "b", "c"], ["a"], ["b"])).toBe(false);
    expect(validateTableAllocation(["a", "b", "c"], ["a", "a"], ["c"])).toBe(false);
    expect(validateTableAllocation(["a", "b", "c"], ["a", "b"], ["other"])).toBe(false);
    expect(validateTableAllocation(["a", "b"], ["a", "b"], [])).toBe(false);
  });
});
