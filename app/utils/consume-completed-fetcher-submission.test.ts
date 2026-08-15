import { describe, expect, it } from "vitest";
import { consumeCompletedFetcherSubmission } from "./consume-completed-fetcher-submission";

describe("consumeCompletedFetcherSubmission", () => {
  it("consumes one completed result only once", () => {
    const pendingRef = { current: true };
    const data = { ok: true };

    expect(
      consumeCompletedFetcherSubmission(pendingRef, "loading", data),
    ).toBeNull();
    expect(pendingRef.current).toBe(true);

    expect(
      consumeCompletedFetcherSubmission(pendingRef, "idle", data),
    ).toBe(data);
    expect(pendingRef.current).toBe(false);

    expect(
      consumeCompletedFetcherSubmission(pendingRef, "idle", data),
    ).toBeNull();
  });

  it("allows the next submitted result to be consumed", () => {
    const pendingRef = { current: false };
    const data = { ok: false };

    pendingRef.current = true;

    expect(
      consumeCompletedFetcherSubmission(pendingRef, "idle", data),
    ).toBe(data);
  });
});
