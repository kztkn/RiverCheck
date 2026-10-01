import { useEffect } from "react";

const MODAL_SELECTOR = 'dialog[open], [role="dialog"][aria-modal="true"]';

export function canConsumeScroll(position: number, contentSize: number, viewportSize: number, delta: number): boolean {
  if (contentSize <= viewportSize) return false;
  return delta > 0 ? position + viewportSize < contentSize - 1 : delta < 0 && position > 0;
}

function canScrollModal(target: EventTarget | null, deltaX: number, deltaY: number): boolean {
  if (!(target instanceof Element)) return false;
  const modal = target.closest(MODAL_SELECTOR);
  if (!modal) return false;
  const horizontal = Math.abs(deltaX) > Math.abs(deltaY);
  for (let element: Element | null = target; element; element = element.parentElement) {
    const style = getComputedStyle(element);
    const overflow = horizontal ? style.overflowX : style.overflowY;
    if ((overflow === "auto" || overflow === "scroll") && canConsumeScroll(
      horizontal ? element.scrollLeft : element.scrollTop,
      horizontal ? element.scrollWidth : element.scrollHeight,
      horizontal ? element.clientWidth : element.clientHeight,
      horizontal ? deltaX : deltaY,
    )) return true;
    if (element === modal) break;
  }
  return false;
}

/** Native dialogs and custom modal overlays share one lock, including nested sheets. */
export function observeModalScrollLock(): () => void {
  const body = document.body;
  const root = document.documentElement;
  let unlock: (() => void) | null = null;
  let lastTouch: { x: number; y: number } | null = null;

  function handleTouchStart(event: TouchEvent) {
    const touch = event.touches[0];
    lastTouch = event.touches.length === 1 && touch ? { x: touch.clientX, y: touch.clientY } : null;
  }
  function handleTouchMove(event: TouchEvent) {
    if (!lastTouch || event.touches.length !== 1) return; // Keep pinch zoom available.
    const touch = event.touches[0]!;
    const dx = lastTouch.x - touch.clientX;
    const dy = lastTouch.y - touch.clientY;
    lastTouch = { x: touch.clientX, y: touch.clientY };
    if ((dx || dy) && !canScrollModal(event.target, dx, dy) && event.cancelable) event.preventDefault();
  }

  function lock() {
    const x = window.scrollX;
    const y = window.scrollY;
    const pathname = window.location.pathname;
    const gap = Math.max(0, window.innerWidth - root.clientWidth);
    const bodyProperties = ["position", "top", "left", "width", "padding-right"];
    const rootProperties = ["overflow-x", "overflow-y", "overscroll-behavior", "scroll-behavior"];
    const savedBody = bodyProperties.map((name) => [name, body.style.getPropertyValue(name), body.style.getPropertyPriority(name)]);
    const savedRoot = rootProperties.map((name) => [name, root.style.getPropertyValue(name), root.style.getPropertyPriority(name)]);

    // overflow:hidden on body alone does not reliably stop scrolling in iOS PWA.
    // Preserve the visible position while fixing the page; each sheet keeps its own scroll.
    if (gap) body.style.setProperty("padding-right", `calc(${getComputedStyle(body).paddingRight} + ${gap}px)`);
    body.style.position = "fixed";
    body.style.top = `${-y}px`;
    body.style.left = `${-x}px`;
    body.style.width = "100%";
    root.style.overflow = "hidden";
    root.style.overscrollBehavior = "none";
    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: false });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      lastTouch = null;
      for (const [name, value, priority] of savedBody) {
        if (value) body.style.setProperty(name!, value, priority);
        else body.style.removeProperty(name!);
      }
      // Restore synchronously so smooth scrolling cannot animate from page top.
      root.style.scrollBehavior = "auto";
      for (const [name, value, priority] of savedRoot.filter(([name]) => name !== "scroll-behavior")) {
        if (value) root.style.setProperty(name!, value, priority);
        else root.style.removeProperty(name!);
      }
      // Navigation owns the new page's scroll restoration, not the old modal.
      if (window.location.pathname === pathname) window.scrollTo(x, y);
      const [, behavior, priority] = savedRoot.find(([name]) => name === "scroll-behavior")!;
      if (behavior) root.style.setProperty("scroll-behavior", behavior, priority);
      else root.style.removeProperty("scroll-behavior");
    };
  }

  function sync() {
    // Mounted profile overlays set aria-modal=false while closed. Use explicit
    // state rather than computed visibility, which changes during CSS transitions.
    const modalOpen = [...document.querySelectorAll(MODAL_SELECTOR)].some((element) =>
      // A picker can remain mounted inside a closed profile overlay.
      !element.closest('[role="dialog"][aria-modal="false"]'),
    );
    if (modalOpen && !unlock) unlock = lock();
    if (!modalOpen && unlock) {
      unlock();
      unlock = null;
    }
  }
  const observer = new MutationObserver(sync);
  observer.observe(body, { subtree: true, childList: true, attributes: true, attributeFilter: ["open", "aria-modal", "role"] });
  sync();
  return () => {
    observer.disconnect();
    unlock?.();
  };
}

export function useModalScrollLock() {
  useEffect(observeModalScrollLock, []);
}
