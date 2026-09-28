import { describe, expect, it, vi } from "vitest";
import { activateViewportLayer } from "./viewport-fixed-layer";

describe("activateViewportLayer", () => {
  it("opens and cleans up a supported manual popover", () => {
    let open = false;
    const element = {
      matches: vi.fn(() => open),
      showPopover: vi.fn(() => {
        open = true;
      }),
      hidePopover: vi.fn(() => {
        open = false;
      }),
      removeAttribute: vi.fn(),
    } as unknown as HTMLElement;

    const cleanup = activateViewportLayer(element);

    expect(
      (element as HTMLElement & { showPopover: () => void }).showPopover,
    ).toHaveBeenCalledOnce();
    cleanup();
    expect(
      (element as HTMLElement & { hidePopover: () => void }).hidePopover,
    ).toHaveBeenCalledOnce();
  });

  it("keeps the body-fixed fallback when popovers are unsupported", () => {
    const element = {
      matches: vi.fn(),
      removeAttribute: vi.fn(),
    } as unknown as HTMLElement;

    expect(() => activateViewportLayer(element)()).not.toThrow();
    expect(element.removeAttribute).not.toHaveBeenCalled();
  });

  it("removes the popover attribute when showing the top layer fails", () => {
    const element = {
      matches: vi.fn(() => false),
      showPopover: vi.fn(() => {
        throw new Error("not fully active");
      }),
      removeAttribute: vi.fn(),
    } as unknown as HTMLElement;

    activateViewportLayer(element);

    expect(element.removeAttribute).toHaveBeenCalledWith("popover");
  });
});
