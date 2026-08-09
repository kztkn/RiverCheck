import { describe, expect, it } from "vitest";
import { formatOrdinal } from "./format-ordinal";

describe("formatOrdinal", () => {
  it.each([
    [1, "1st"],
    [2, "2nd"],
    [3, "3rd"],
    [4, "4th"],
    [11, "11th"],
    [12, "12th"],
    [13, "13th"],
    [21, "21st"],
  ])("%iを%sへ変換する", (rank, expected) => {
    expect(formatOrdinal(rank)).toBe(expected);
  });

  it("正の整数以外を拒否する", () => {
    expect(() => formatOrdinal(0)).toThrow(RangeError);
    expect(() => formatOrdinal(1.5)).toThrow(RangeError);
  });
});
