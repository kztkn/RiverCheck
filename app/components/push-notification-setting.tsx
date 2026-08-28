import { IconBell, IconBellOff } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";

export interface PushNotificationSettingsView {
  available: boolean;
  enabled: boolean;
  endpointHash: string | null;
  publicKey: string | null;
}

type SettingStatus =
  | "checking"
  | "on"
  | "off"
  | "other-device"
  | "install-required"
  | "denied"
  | "unsupported"
  | "unconfigured"
  | "error";

type PushSettingActionData =
  | { intent: "enable-push" | "disable-push"; ok: true }
  | {
      intent: "enable-push" | "disable-push";
      ok: false;
      error: string;
    };

export function PushNotificationSetting({
  settings,
}: {
  settings: PushNotificationSettingsView;
}) {
  const fetcher = useFetcher<PushSettingActionData>();
  const [status, setStatus] = useState<SettingStatus>("checking");
  const [error, setError] = useState<string | null>(null);
  const pendingIntentRef = useRef<"enable-push" | "disable-push" | null>(
    null,
  );
  const localSubscriptionRef = useRef<PushSubscription | null>(null);

  useEffect(() => {
    let disposed = false;
    void inspectCurrentDevice(settings).then((result) => {
      if (disposed) return;
      localSubscriptionRef.current = result.subscription;
      setStatus(result.status);
    });
    return () => {
      disposed = true;
    };
  }, [
    settings.available,
    settings.enabled,
    settings.endpointHash,
    settings.publicKey,
  ]);

  useEffect(() => {
    const pendingIntent = pendingIntentRef.current;
    if (fetcher.state !== "idle" || !pendingIntent || !fetcher.data) return;
    if (fetcher.data.intent !== pendingIntent) return;
    pendingIntentRef.current = null;
    if (!fetcher.data.ok) {
      setError(fetcher.data.error);
      setStatus("error");
      return;
    }
    setError(null);
    if (pendingIntent === "enable-push") {
      setStatus("on");
      return;
    }
    const currentSubscription = localSubscriptionRef.current;
    localSubscriptionRef.current = null;
    void currentSubscription?.unsubscribe().catch(() => false);
    setStatus("off");
  }, [fetcher.data, fetcher.state]);

  const isWorking = fetcher.state !== "idle" || status === "checking";
  const isOn = status === "on";
  const isToggleDisabled =
    isWorking ||
    status === "install-required" ||
    status === "denied" ||
    status === "unsupported" ||
    status === "unconfigured";
  const description = getDescription(status, error);

  async function handleToggle() {
    if (isToggleDisabled) return;
    setError(null);
    if (isOn) {
      pendingIntentRef.current = "disable-push";
      await fetcher.submit(
        { intent: "disable-push" },
        { method: "post" },
      );
      return;
    }
    const publicKey = settings.publicKey;
    if (!publicKey) {
      setStatus("unconfigured");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          applicationServerKey: decodeBase64Url(publicKey),
          userVisibleOnly: true,
        }));
      const serialized = subscription.toJSON();
      const endpoint = serialized.endpoint;
      const auth = serialized.keys?.auth;
      const p256dh = serialized.keys?.p256dh;
      if (!endpoint || !auth || !p256dh) {
        throw new Error("Push subscription did not include encryption keys");
      }
      localSubscriptionRef.current = subscription;
      pendingIntentRef.current = "enable-push";
      await fetcher.submit(
        { auth, endpoint, intent: "enable-push", p256dh },
        { method: "post" },
      );
    } catch {
      pendingIntentRef.current = null;
      setError("通知を設定できませんでした。時間をおいて再度お試しください。");
      setStatus("error");
    }
  }

  return (
    <section
      aria-labelledby="push-notification-heading"
      className="profile-notification-setting"
    >
      <div className="profile-notification-copy">
        <span className="profile-notification-icon" aria-hidden="true">
          {isOn ? (
            <IconBell size={21} stroke={1.8} />
          ) : (
            <IconBellOff size={21} stroke={1.8} />
          )}
        </span>
        <div>
          <h2 id="push-notification-heading">開催通知</h2>
          <p>{description}</p>
        </div>
      </div>
      <button
        aria-checked={isOn}
        aria-label="この端末の開催通知"
        className="profile-notification-switch"
        disabled={isToggleDisabled}
        onClick={() => void handleToggle()}
        role="switch"
        type="button"
      >
        <span aria-hidden="true" />
        <span className="sr-only">{isOn ? "オン" : "オフ"}</span>
      </button>
    </section>
  );
}

async function inspectCurrentDevice(
  settings: PushNotificationSettingsView,
): Promise<{ status: SettingStatus; subscription: PushSubscription | null }> {
  if (!settings.available || !settings.publicKey) {
    return { status: "unconfigured", subscription: null };
  }
  if (!import.meta.env.PROD) {
    return { status: "unsupported", subscription: null };
  }
  if (isIosDevice() && !isStandaloneDisplay()) {
    return { status: "install-required", subscription: null };
  }
  if (
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    return { status: "unsupported", subscription: null };
  }
  if (Notification.permission === "denied") {
    return { status: "denied", subscription: null };
  }
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      return {
        status: settings.enabled ? "other-device" : "off",
        subscription: null,
      };
    }
    const currentEndpointHash = await hashEndpoint(subscription.endpoint);
    return {
      status:
        settings.enabled && currentEndpointHash === settings.endpointHash
          ? "on"
          : settings.enabled
            ? "other-device"
            : "off",
      subscription,
    };
  } catch {
    return { status: "error", subscription: null };
  }
}

function getDescription(status: SettingStatus, error: string | null): string {
  if (status === "on") return "新しい開催をこの端末へお知らせします。";
  if (status === "other-device") {
    return "別の端末で通知中です。ONにするとこの端末へ切り替わります。";
  }
  if (status === "install-required") {
    return "ホーム画面に追加したRiverCheckから設定できます。";
  }
  if (status === "denied") {
    return "端末の設定でRiverCheckの通知を許可してください。";
  }
  if (status === "unsupported") {
    return import.meta.env.PROD
      ? "このブラウザでは開催通知を利用できません。"
      : "通知は本番PWAで設定できます。";
  }
  if (status === "unconfigured") return "通知機能は現在準備中です。";
  if (status === "error") {
    return error ?? "通知状態を確認できませんでした。";
  }
  if (status === "checking") return "この端末の通知状態を確認しています。";
  return "新しい開催をこの端末へお知らせします。";
}

function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replaceAll("-", "+").replaceAll("_", "/");
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

async function hashEndpoint(endpoint: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(endpoint),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function isStandaloneDisplay(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && navigator.standalone === true)
  );
}

function isIosDevice(): boolean {
  return (
    /iPad|iPhone|iPod/u.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}
