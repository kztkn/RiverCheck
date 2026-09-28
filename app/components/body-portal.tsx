import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Keep the server and first client render inline, then move floating UI below
 * body after hydration. This avoids hydration mismatches while escaping page
 * scroll containers on mobile Safari.
 */
export function BodyPortal({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setTarget(document.body);
  }, []);

  return target ? createPortal(children, target) : children;
}
