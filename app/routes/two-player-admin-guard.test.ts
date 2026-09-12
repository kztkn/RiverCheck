import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("two-player admin finalization copy", () => {
  it("does not retain the legacy four-player guard", () => {
    const source = readFileSync("app/routes/game-admin.tsx", "utf8");
    expect(source).not.toContain("結果確定には4人以上必要です");
    expect(source).toContain("finalization.participantCount < 2");
  });
});
