import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type PopoverElement = HTMLElement & {
  hidePopover?: () => void;
  showPopover?: () => void;
};

/**
 * Put persistent floating controls in the browser top layer.
 *
 * iOS can treat `position: fixed` as page-relative while scrolling when the
 * control lives in the normal document layer. A manual popover escapes every
 * page scroll/transform container. The fixed body layer remains the fallback
 * for browsers without the Popover API.
 */
export function ViewportFixedLayer({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTarget(document.body);
  }, []);

  useEffect(() => {
    const layer = layerRef.current;
    if (!target || !layer) return;
    return activateViewportLayer(layer);
  }, [target]);

  if (!target) return null;

  return createPortal(
    <div
      className="viewport-fixed-layer"
      popover="manual"
      ref={layerRef}
    >
      {children}
    </div>,
    target,
  );
}

export function activateViewportLayer(element: HTMLElement): () => void {
  const popover = element as PopoverElement;

  if (typeof popover.showPopover !== "function") {
    return () => undefined;
  }

  try {
    if (!element.matches(":popover-open")) popover.showPopover();
  } catch {
    // Keep the body-level fixed layer visible if this browser exposes an
    // incomplete Popover API implementation.
    element.removeAttribute("popover");
  }

  return () => {
    try {
      if (
        typeof popover.hidePopover === "function" &&
        element.matches(":popover-open")
      ) {
        popover.hidePopover();
      }
    } catch {
      // The node may already be detached while navigating.
    }
  };
}
