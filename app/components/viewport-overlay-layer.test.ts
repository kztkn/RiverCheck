import { describe, expect, it } from "vitest";
import { resolveViewportOverlayTarget } from "./viewport-overlay-layer";

describe("viewport overlay layer", () => {
  it("uses the overlay root outside the page scroller", () => {
    const host = {} as HTMLElement;
    const body = {} as HTMLElement;
    const target = resolveViewportOverlayTarget({
      body,
      getElementById: () => host,
    });

    expect(target).toBe(host);
  });

  it("falls back to body if the layout host is unavailable", () => {
    const body = {} as HTMLElement;
    const target = resolveViewportOverlayTarget({
      body,
      getElementById: () => null,
    });

    expect(target).toBe(body);
  });
});
