import { describe, expect, it } from "vitest";
import { increasedTableCounts } from "../components/table-now";

describe("LIVE TABLE updates", () => {
  const counts = { allInCount: 2, bombPotCount: 0, sevenDeuceCount: 1, playerCount: 6 };
  it("highlights only increased counts, including the first event of a type", () => {
    expect(increasedTableCounts(counts, { ...counts, bombPotCount: 1, playerCount: 7 }))
      .toEqual(["bombPotCount", "playerCount"]);
  });
  it("does not highlight unchanged counts, cancellations, or unavailable-to-known counts", () => {
    expect(increasedTableCounts(counts, counts)).toEqual([]);
    expect(increasedTableCounts(counts, { ...counts, allInCount: 1 })).toEqual([]);
    expect(increasedTableCounts({ ...counts, playerCount: null }, counts)).toEqual([]);
  });
});
