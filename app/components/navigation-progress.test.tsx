import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NavigationProgress } from "./navigation-progress";

describe("NavigationProgress", () => {
  it("is hidden while navigation is idle", () => {
    const markup = renderToStaticMarkup(
      createElement(NavigationProgress, { active: false }),
    );

    expect(markup).toContain('aria-hidden="true"');
    expect(markup).not.toContain('role="progressbar"');
    expect(markup).not.toContain("is-active");
  });

  it("announces and shows progress during navigation", () => {
    const markup = renderToStaticMarkup(
      createElement(NavigationProgress, { active: true }),
    );

    expect(markup).toContain('role="progressbar"');
    expect(markup).toContain("ページを読み込み中");
    expect(markup).toContain("is-active");
  });
});
