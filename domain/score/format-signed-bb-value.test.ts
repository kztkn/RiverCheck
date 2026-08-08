import { describe, expect, it } from "vitest";
import { formatSignedBbValue } from "./bb-score";

describe("formatSignedBbValue", () => {
  it("戦績の正負と小数を読みやすく表示する", () => {
    expect(formatSignedBbValue(12.345)).toBe("+12.35BB");
    expect(formatSignedBbValue(0)).toBe("0BB");
    expect(formatSignedBbValue(-7.5)).toBe("-7.5BB");
  });
});
