/** Poll only while visible; never overlap refreshes or interrupt an active edit. */
export function startVisiblePolling({
  page,
  view,
  refresh,
  canRefresh,
  intervalMs = 5_000,
}: {
  page: Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener">;
  view: Pick<Window, "addEventListener" | "removeEventListener" | "setInterval" | "clearInterval">;
  refresh: () => void | Promise<void>;
  canRefresh: () => boolean;
  intervalMs?: number;
}) {
  let timer: number | undefined;
  let pending = false;
  let disposed = false;

  async function tick() {
    if (disposed || pending || page.visibilityState !== "visible" || !canRefresh()) return;
    pending = true;
    try {
      await refresh();
    } catch {
      // Leave the current view intact; the next visible tick can retry.
    } finally {
      pending = false;
    }
  }

  function syncTimer() {
    if (timer !== undefined) view.clearInterval(timer);
    timer = page.visibilityState === "visible"
      ? view.setInterval(() => void tick(), intervalMs)
      : undefined;
  }

  function resume() {
    syncTimer();
    void tick();
  }

  syncTimer();
  page.addEventListener("visibilitychange", resume);
  view.addEventListener("pageshow", resume);
  view.addEventListener("focus", resume);
  return () => {
    disposed = true;
    if (timer !== undefined) view.clearInterval(timer);
    page.removeEventListener("visibilitychange", resume);
    view.removeEventListener("pageshow", resume);
    view.removeEventListener("focus", resume);
  };
}
