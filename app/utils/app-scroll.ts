import { useEffect } from "react";

export const APP_SCROLL_ROOT_ID = "app-scroll-root";

interface ScrollLockState {
  count: number;
  previousOverflow: string;
  target: HTMLElement;
}

const scrollLockStates = new WeakMap<Document, ScrollLockState>();

export function resolveAppScrollTarget(
  ownerDocument: Pick<Document, "body" | "getElementById">,
): HTMLElement {
  return ownerDocument.getElementById(APP_SCROLL_ROOT_ID) ?? ownerDocument.body;
}

export function lockAppScroll(ownerDocument: Document): () => void {
  const current = scrollLockStates.get(ownerDocument);
  if (current) {
    current.count += 1;
    return createUnlock(ownerDocument, current);
  }

  const target = resolveAppScrollTarget(ownerDocument);
  const state: ScrollLockState = {
    count: 1,
    previousOverflow: target.style.overflow,
    target,
  };
  target.style.overflow = "hidden";
  scrollLockStates.set(ownerDocument, state);
  return createUnlock(ownerDocument, state);
}

export function useAppScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked) return;
    return lockAppScroll(document);
  }, [locked]);
}

function createUnlock(
  ownerDocument: Document,
  state: ScrollLockState,
): () => void {
  let unlocked = false;
  return () => {
    if (unlocked) return;
    unlocked = true;
    state.count -= 1;
    if (state.count > 0) return;

    state.target.style.overflow = state.previousOverflow;
    scrollLockStates.delete(ownerDocument);
  };
}
