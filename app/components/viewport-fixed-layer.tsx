import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface ViewportLayerMetrics {
  height: number;
  pageLeft: number;
  pageTop: number;
  width: number;
}

/**
 * Keep floating controls attached to the visual viewport on iOS.
 *
 * Mobile Safari can scroll both fixed elements and top-layer popovers with the
 * layout viewport. This body-level absolute layer follows VisualViewport's
 * document coordinates instead of relying on `position: fixed`.
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

    const syncPosition = () => {
      positionViewportLayer(layer, readViewportLayerMetrics(window));
    };
    const visualViewport = window.visualViewport;

    syncPosition();
    window.addEventListener("scroll", syncPosition, { passive: true });
    window.addEventListener("resize", syncPosition);
    window.addEventListener("orientationchange", syncPosition);
    visualViewport?.addEventListener("scroll", syncPosition, { passive: true });
    visualViewport?.addEventListener("resize", syncPosition);

    return () => {
      window.removeEventListener("scroll", syncPosition);
      window.removeEventListener("resize", syncPosition);
      window.removeEventListener("orientationchange", syncPosition);
      visualViewport?.removeEventListener("scroll", syncPosition);
      visualViewport?.removeEventListener("resize", syncPosition);
    };
  }, [target]);

  if (!target) return null;

  return createPortal(
    <div className="viewport-fixed-layer" ref={layerRef}>
      {children}
    </div>,
    target,
  );
}

export function readViewportLayerMetrics(view: Window): ViewportLayerMetrics {
  const viewport = view.visualViewport;
  return {
    height: viewport?.height ?? view.innerHeight,
    pageLeft: viewport?.pageLeft ?? view.scrollX,
    pageTop: viewport?.pageTop ?? view.scrollY,
    width: viewport?.width ?? view.innerWidth,
  };
}

export function positionViewportLayer(
  element: HTMLElement,
  metrics: ViewportLayerMetrics,
): void {
  element.style.width = `${metrics.width}px`;
  element.style.height = `${metrics.height}px`;
  element.style.transform =
    `translate3d(${metrics.pageLeft}px, ${metrics.pageTop}px, 0)`;
}
