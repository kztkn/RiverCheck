import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";

export function AppToast({
  message,
  searchParam,
}: {
  message: string | null;
  searchParam?: string;
}) {
  const [visible, setVisible] = useState(Boolean(message));
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!message) {
      setVisible(false);
      return;
    }

    setVisible(true);
    if (searchParam) {
      const search = new URLSearchParams(location.search);
      if (search.has(searchParam)) {
        search.delete(searchParam);
        const nextSearch = search.toString();
        void navigate(
          {
            pathname: location.pathname,
            search: nextSearch ? `?${nextSearch}` : "",
            hash: location.hash,
          },
          { preventScrollReset: true, replace: true },
        );
      }
    }

    const timer = window.setTimeout(() => setVisible(false), 3000);
    return () => window.clearTimeout(timer);
  }, [
    location.hash,
    location.pathname,
    location.search,
    message,
    navigate,
    searchParam,
  ]);

  if (!message || !visible) return null;

  return (
    <div aria-live="polite" className="app-toast" role="status">
      <span aria-hidden="true">✓</span>
      {message}
    </div>
  );
}
