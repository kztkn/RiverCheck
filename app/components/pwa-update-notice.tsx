import { useEffect, useRef, useState } from "react";

const SERVICE_WORKER_URL = "/sw.js";

export function PwaUpdateNotice() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const reloadOnControllerChange = useRef(false);

  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;

    let disposed = false;
    let registration: ServiceWorkerRegistration | null = null;
    let installingWorker: ServiceWorker | null = null;

    const checkForUpdate = () => {
      if (disposed) return;
      void requestServiceWorkerUpdate(registration);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") checkForUpdate();
    };
    const handlePageShow = () => checkForUpdate();
    const handleInstallingStateChange = () => {
      if (
        !disposed &&
        installingWorker?.state === "installed" &&
        navigator.serviceWorker.controller
      ) {
        setWaitingWorker(installingWorker);
      }
    };
    const handleUpdateFound = () => {
      installingWorker?.removeEventListener(
        "statechange",
        handleInstallingStateChange,
      );
      installingWorker = registration?.installing ?? null;
      installingWorker?.addEventListener(
        "statechange",
        handleInstallingStateChange,
      );
    };
    const handleControllerChange = () => {
      if (!reloadOnControllerChange.current) return;
      reloadOnControllerChange.current = false;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      handleControllerChange,
    );
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pageshow", handlePageShow);

    void navigator.serviceWorker
      .register(SERVICE_WORKER_URL, {
        scope: "/",
        updateViaCache: "none",
      })
      .then((registered) => {
        if (disposed) return;
        registration = registered;
        if (registration.waiting && navigator.serviceWorker.controller) {
          setWaitingWorker(registration.waiting);
        }
        registration.addEventListener("updatefound", handleUpdateFound);
        checkForUpdate();
      })
      .catch(() => {
        // PWA enhancements must never block the normal web application.
      });

    return () => {
      disposed = true;
      installingWorker?.removeEventListener(
        "statechange",
        handleInstallingStateChange,
      );
      registration?.removeEventListener("updatefound", handleUpdateFound);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        handleControllerChange,
      );
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  if (!waitingWorker) return null;

  function applyUpdate() {
    reloadOnControllerChange.current = true;
    setIsUpdating(true);
    waitingWorker?.postMessage({ type: "SKIP_WAITING" });
  }

  return (
    <aside
      aria-live="polite"
      className="pwa-update-notice"
      role="status"
    >
      <div>
        <strong>新しいバージョンがあります</strong>
        <p>入力内容を保存してから更新してください。</p>
      </div>
      <button disabled={isUpdating} onClick={applyUpdate} type="button">
        {isUpdating ? "更新中…" : "更新する"}
      </button>
    </aside>
  );
}

export async function requestServiceWorkerUpdate(
  registration: Pick<ServiceWorkerRegistration, "update"> | null,
): Promise<void> {
  if (!registration) return;
  try {
    await registration.update();
  } catch {
    // Update checks are best effort and must not disrupt the application.
  }
}
