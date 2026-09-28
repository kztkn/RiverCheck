import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export const VIEWPORT_FIXED_ROOT_ID = "viewport-fixed-root";

/**
 * Mount floating controls in the sticky viewport host rendered before the
 * scrollable page. The host avoids iOS fixed-position and VisualViewport
 * coordinate drift without moving the controls from JavaScript.
 */
export function ViewportFixedLayer({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setTarget(resolveViewportFixedTarget(document));
  }, []);

  if (!target) return null;

  return createPortal(
    <div className="viewport-fixed-layer">
      {children}
    </div>,
    target,
  );
}

export function resolveViewportFixedTarget(
  ownerDocument: Pick<Document, "body" | "getElementById">,
): HTMLElement {
  return ownerDocument.getElementById(VIEWPORT_FIXED_ROOT_ID) ?? ownerDocument.body;
}
