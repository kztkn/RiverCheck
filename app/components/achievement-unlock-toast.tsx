import { useEffect, useState } from "react";
import { AchievementIcon } from "~/components/achievement-icon";
import type { PendingAchievementNotification } from "@shared-types/achievement";

export function AchievementUnlockToast({
  groupCode,
  items,
}: {
  groupCode: string;
  items: PendingAchievementNotification[];
}) {
  const [queue, setQueue] = useState(items);
  const current = queue[0] ?? null;

  useEffect(() => {
    if (!current) return;

    const formData = new FormData();
    formData.set("playerAchievementId", current.playerAchievementId);
    void fetch(`/g/${groupCode}/achievement-notifications`, {
      method: "POST",
      body: formData,
    }).catch(() => {
      // Keep the unlock visible now. If acknowledgement failed, a future load
      // will show it again instead of silently losing the notification.
    });

    const timer = window.setTimeout(() => {
      setQueue((currentQueue) => currentQueue.slice(1));
    }, 4200);
    return () => window.clearTimeout(timer);
  }, [current, groupCode]);

  if (!current) return null;

  return (
    <div
      aria-live="polite"
      className="app-toast achievement-unlock-toast"
      role="status"
    >
      <span aria-hidden="true">
        <AchievementIcon iconKey={current.iconKey} />
      </span>
      <span className="achievement-unlock-toast-copy">
        <small>NEW TITLE</small>
        <strong>{current.name}</strong>
        <em>{current.description}</em>
      </span>
    </div>
  );
}
