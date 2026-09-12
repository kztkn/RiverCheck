import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("participant result refresh UX", () => {
  it("uses a result-screen CTA and explains when finalization is still pending", () => {
    const source = readFileSync("app/routes/game-participant.tsx", "utf8");
    expect(source).toContain("結果画面へ");
    expect(source).toContain("まだ結果は確定していません。主催者が結果を確定したあと、もう一度お試しください。");
    expect(source).toContain("submitted-input-actions");
    expect(source).not.toContain("確定結果を確認する");
  });
});
