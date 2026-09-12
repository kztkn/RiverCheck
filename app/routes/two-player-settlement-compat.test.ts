import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("2人精算のlegacy top-3互換値", () => {
  it("2人のcost_sharesでもDBのNOT NULL列向けに3位値を補完する", () => {
    const source = readFileSync("server/services/game-service.server.ts", "utf8");
    expect(source).toContain("parsedShares[2] ?? parsedShares[1] ?? parsedShares[0] ?? null");
  });
});
