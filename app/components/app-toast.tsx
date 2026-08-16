import { useEffect, useState } from "react";

export function AppToast({
  message,
  searchParam,
}: {
  message: string | null;
  searchParam?: string;
}) {
  const [visible, setVisible] = useState(Boolean(message));

  useEffect(() => {
    if (!message) {
      setVisible(false);
      return;
    }

    setVisible(true);
    if (searchParam) {
      const url = new URL(window.location.href);
      url.searchParams.delete(searchParam);
      window.history.replaceState(
        window.history.state,
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
    }

    const timer = window.setTimeout(() => setVisible(false), 3000);
    return () => window.clearTimeout(timer);
  }, [message, searchParam]);

  if (!message || !visible) return null;

  return (
    <div aria-live="polite" className="app-toast" role="status">
      <span aria-hidden="true">✓</span>
      {message}
    </div>
  );
}
