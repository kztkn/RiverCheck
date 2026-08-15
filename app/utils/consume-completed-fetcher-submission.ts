type FetcherState = "idle" | "loading" | "submitting";

export function consumeCompletedFetcherSubmission<T>(
  pendingRef: { current: boolean },
  state: FetcherState,
  data: T | undefined,
): T | null {
  if (state !== "idle" || !pendingRef.current) return null;

  pendingRef.current = false;
  return data ?? null;
}
