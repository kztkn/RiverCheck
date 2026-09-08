import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const participantRoute = readFileSync("app/routes/game-participant.tsx", "utf8");
const component = readFileSync("app/components/table-now.tsx", "utf8");
const styles = readFileSync("app/styles/table-now.css", "utf8");
describe("TABLE NOW presentation", () => {
  it("renders only for open games through loader data", () => {
    expect(participantRoute).toContain('tableNow: context.game.status === "open"');
    expect(participantRoute).toContain('<TableNow data={loaderData.tableNow} />');
  });
  it("keeps zero-count events out", () => {
    expect(component).toContain("data.allInCount > 0");
    expect(component).toContain("data.bombPotCount > 0");
    expect(component).toContain("data.sevenDeuceCount > 0");
  });
  it("scrolls horizontally on narrow screens", () => {
    expect(styles).toContain("overflow-x:auto");
    expect(styles).toContain("white-space:nowrap");
  });
});
