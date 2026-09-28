import { describe, expect, it } from "vitest";
import { resolveViewportFixedTarget } from "./viewport-fixed-layer";

describe("viewport fixed layer", () => {
  it("uses the dedicated sticky viewport host", () => {
    const host = {} as HTMLElement;
    const body = {} as HTMLElement;
    const target = resolveViewportFixedTarget({
      body,
      getElementById: () => host,
    });

    expect(target).toBe(host);
  });

  it("falls back to body if the layout host is unavailable", () => {
    const body = {} as HTMLElement;
    const target = resolveViewportFixedTarget({
      body,
      getElementById: () => null,
    });

    expect(target).toBe(body);
  });
});
