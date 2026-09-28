import { useEffect, useLayoutEffect } from "react";
import { useLocation, useNavigationType } from "react-router";
import { APP_SCROLL_ROOT_ID } from "~/utils/app-scroll";

const STORAGE_PREFIX = "rivercheck:scroll:";

interface ScrollPositionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const useIsomorphicLayoutEffect =
  typeof document === "undefined" ? useEffect : useLayoutEffect;

export function AppScrollRestoration() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const locationKey = resolveAppScrollLocationKey(location);

  useIsomorphicLayoutEffect(() => {
    const scrollRoot = document.getElementById(APP_SCROLL_ROOT_ID);
    if (!scrollRoot) return;
    const storage = resolveSessionStorage(window);

    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";

    const restorePosition = resolveAppScrollPosition({
      currentPosition: scrollRoot.scrollTop,
      navigationType,
      storedPosition: storage
        ? readAppScrollPosition(storage, locationKey)
        : 0,
    });
    scrollRoot.scrollTop = restorePosition;

    const savePosition = () => {
      if (!storage) return;
      writeAppScrollPosition(
        storage,
        locationKey,
        scrollRoot.scrollTop,
      );
    };
    window.addEventListener("pagehide", savePosition);

    return () => {
      savePosition();
      window.removeEventListener("pagehide", savePosition);
      window.history.scrollRestoration = previousRestoration;
    };
  }, [locationKey, navigationType]);

  return null;
}

export function readAppScrollPosition(
  storage: ScrollPositionStorage,
  locationKey: string,
): number {
  try {
    const stored = storage.getItem(getAppScrollStorageKey(locationKey));
    if (stored === null) return 0;
    const position = Number(stored);
    return Number.isFinite(position) && position >= 0 ? position : 0;
  } catch {
    return 0;
  }
}

export function writeAppScrollPosition(
  storage: ScrollPositionStorage,
  locationKey: string,
  position: number,
): void {
  try {
    storage.setItem(
      getAppScrollStorageKey(locationKey),
      String(Math.max(0, Math.round(position))),
    );
  } catch {
    // Scroll restoration is a progressive enhancement.
  }
}

export function getAppScrollStorageKey(locationKey: string): string {
  return `${STORAGE_PREFIX}${locationKey}`;
}

export function resolveAppScrollLocationKey({
  hash,
  key,
  pathname,
  search,
}: {
  hash: string;
  key: string;
  pathname: string;
  search: string;
}): string {
  return key && key !== "default"
    ? key
    : `initial:${pathname}${search}${hash}`;
}

export function resolveAppScrollPosition({
  currentPosition,
  navigationType,
  storedPosition,
}: {
  currentPosition: number;
  navigationType: "POP" | "PUSH" | "REPLACE";
  storedPosition: number;
}): number {
  if (navigationType === "POP") return storedPosition;
  if (navigationType === "REPLACE") return currentPosition;
  return 0;
}

function resolveSessionStorage(
  ownerWindow: Pick<Window, "sessionStorage">,
): ScrollPositionStorage | null {
  try {
    return ownerWindow.sessionStorage;
  } catch {
    return null;
  }
}
