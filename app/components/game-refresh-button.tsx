import type { ReactNode } from "react";
import { useFetchers, useNavigation, useRevalidator } from "react-router";

export function GameRefreshButton({ children }: { children: ReactNode }) {
  const revalidator = useRevalidator();
  const navigation = useNavigation();
  const fetchers = useFetchers();
  const busy = revalidator.state !== "idle"
    || navigation.state !== "idle"
    || fetchers.some((fetcher) => fetcher.state !== "idle");

  return (
    <button
      className="button button-secondary game-refresh-button"
      disabled={busy}
      onClick={() => { if (!busy) void revalidator.revalidate(); }}
      type="button"
    >
      {revalidator.state === "loading" ? "更新中…" : children}
    </button>
  );
}
