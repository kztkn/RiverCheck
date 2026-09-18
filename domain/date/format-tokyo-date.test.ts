import { describe, expect, it } from "vitest";
import { formatTokyoDateNumeric } from "./format-tokyo-date";

describe("formatTokyoDateNumeric", () => {
  it("UTCでは前日でも東京の日付を使う", () => {
    expect(formatTokyoDateNumeric("2026-08-18T15:00:00.000Z")).toBe(
      "2026/08/19",
    );
  });
});
