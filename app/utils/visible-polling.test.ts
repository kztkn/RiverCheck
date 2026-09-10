import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startVisiblePolling } from "./visible-polling";

describe("visible game polling", () => {
  let page: EventTarget & { visibilityState: DocumentVisibilityState };
  let view: EventTarget & Pick<Window, "setInterval" | "clearInterval">;
  let refresh: ReturnType<typeof vi.fn<() => void | Promise<void>>>;
  let canRefresh: ReturnType<typeof vi.fn<() => boolean>>;
  let stop: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    page = Object.assign(new EventTarget(), { visibilityState: "visible" as DocumentVisibilityState });
    view = Object.assign(new EventTarget(), {
      setInterval: globalThis.setInterval as unknown as Window["setInterval"],
      clearInterval: globalThis.clearInterval as Window["clearInterval"],
    });
    refresh = vi.fn();
    canRefresh = vi.fn(() => true);
    stop = startVisiblePolling({ page, view, refresh, canRefresh });
  });
  afterEach(() => { stop(); vi.useRealTimers(); });

  it("refreshes after five seconds, stops hidden, resumes immediately, and cleans up", async () => {
    expect(refresh).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(refresh).toHaveBeenCalledTimes(1);
    page.visibilityState = "hidden";
    page.dispatchEvent(new Event("visibilitychange"));
    expect(vi.getTimerCount()).toBe(0);
    view.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(20_000);
    expect(refresh).toHaveBeenCalledTimes(1);
    page.visibilityState = "visible";
    page.dispatchEvent(new Event("visibilitychange"));
    expect(refresh).toHaveBeenCalledTimes(2);
    stop();
    view.dispatchEvent(new Event("pageshow"));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("skips editing and busy submissions without losing the next refresh", async () => {
    canRefresh.mockReturnValue(false);
    view.dispatchEvent(new Event("pageshow"));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(refresh).not.toHaveBeenCalled();
    canRefresh.mockReturnValue(true);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("does not overlap slow requests across focus and interval events", async () => {
    let finish!: () => void;
    refresh.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
    view.dispatchEvent(new Event("focus"));
    view.dispatchEvent(new Event("pageshow"));
    await vi.advanceTimersByTimeAsync(15_000);
    expect(refresh).toHaveBeenCalledTimes(1);
    finish();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("retries on the next visible interval after a failed refresh", async () => {
    refresh.mockRejectedValueOnce(new Error("offline"));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
