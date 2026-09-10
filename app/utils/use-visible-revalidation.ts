import { useEffect, useRef } from "react";
import { useFetchers, useNavigation, useRevalidator } from "react-router";
import { startVisiblePolling } from "./visible-polling";

export function useVisibleRevalidation(enabled: boolean) {
  const revalidator = useRevalidator();
  const navigation = useNavigation();
  const fetchers = useFetchers();
  const current = useRef({ revalidator, navigation, fetchers });

  useEffect(() => {
    current.current = { revalidator, navigation, fetchers };
  }, [revalidator, navigation, fetchers]);

  useEffect(() => {
    if (!enabled) return;
    return startVisiblePolling({
      page: document,
      view: window,
      refresh: () => current.current.revalidator.revalidate(),
      canRefresh: () => {
        const state = current.current;
        return state.revalidator.state === "idle"
          && state.navigation.state === "idle"
          && state.fetchers.every((fetcher) => fetcher.state === "idle")
          && !document.activeElement?.matches("input, textarea, select, [contenteditable='true']")
          && !document.querySelector("[data-pause-live-refresh='true'], dialog[open] form");
      },
    });
  }, [enabled]);
}
