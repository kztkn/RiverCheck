import { describe, expect, it } from "vitest";
import { lockAppScroll, resolveAppScrollTarget } from "./app-scroll";

describe("app scroll", () => {
  it("targets the dedicated page scroller and falls back to body", () => {
    const scrollRoot = {} as HTMLElement;
    const body = {} as HTMLElement;

    expect(
      resolveAppScrollTarget({ body, getElementById: () => scrollRoot }),
    ).toBe(scrollRoot);
    expect(resolveAppScrollTarget({ body, getElementById: () => null })).toBe(
      body,
    );
  });

  it("keeps nested locks active until their final cleanup", () => {
    const target = { style: { overflow: "auto" } } as HTMLElement;
    const ownerDocument = {
      body: target,
      getElementById: () => target,
    } as unknown as Document;

    const unlockFirst = lockAppScroll(ownerDocument);
    const unlockSecond = lockAppScroll(ownerDocument);
    expect(target.style.overflow).toBe("hidden");

    unlockFirst();
    expect(target.style.overflow).toBe("hidden");

    unlockSecond();
    expect(target.style.overflow).toBe("auto");
  });
});
