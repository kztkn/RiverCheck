import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export const VIEWPORT_OVERLAY_ROOT_ID = "viewport-overlay-root";

/**
 * Mount persistent controls outside the independently scrolling page content.
 * The overlay root itself never scrolls, so controls need no fixed/sticky
 * positioning or viewport-coordinate correction.
 */
export function ViewportOverlayLayer({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setTarget(resolveViewportOverlayTarget(document));
  }, []);

  if (!target) return null;

  return createPortal(
    <div className="viewport-overlay-layer">{children}</div>,
    target,
  );
}

export function resolveViewportOverlayTarget(
  ownerDocument: Pick<Document, "body" | "getElementById">,
): HTMLElement {
  return (
    ownerDocument.getElementById(VIEWPORT_OVERLAY_ROOT_ID) ??
    ownerDocument.body
  );
}
