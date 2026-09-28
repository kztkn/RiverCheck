import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const rootSource = readFileSync("app/root.tsx", "utf8");
const appCss = readFileSync("app/styles/app.css", "utf8");
const tableEventCss = readFileSync("app/styles/table-events.css", "utf8");

describe("app viewport shell", () => {
  it("separates scrollable content from persistent viewport overlays", () => {
    expect(rootSource).toMatch(
      /id="app-shell"[\s\S]*id=\{APP_SCROLL_ROOT_ID\}[\s\S]*id=\{VIEWPORT_OVERLAY_ROOT_ID\}/u,
    );
    expect(rootSource).not.toContain("<ScrollRestoration");
    expect(appCss).toMatch(
      /body\s*\{[^}]*position:\s*fixed;[^}]*overflow:\s*hidden;/su,
    );
    expect(appCss).toMatch(
      /#app-scroll-root\s*\{[^}]*overflow-y:\s*auto;/su,
    );
    expect(appCss).toMatch(
      /#viewport-overlay-root\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*0;/su,
    );
  });

  it("positions floating controls inside the non-scrolling overlay", () => {
    expect(tableEventCss).toMatch(
      /\.table-event-floating-button\s*\{[^}]*position:\s*absolute;/su,
    );
    expect(appCss).toMatch(
      /\.pwa-update-notice\s*\{[^}]*position:\s*absolute;/su,
    );
    expect(appCss).toMatch(
      /\.app-toast\s*\{[^}]*position:\s*absolute;/su,
    );
  });
});
