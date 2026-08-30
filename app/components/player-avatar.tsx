import { useState } from "react";

export function PlayerAvatar({
  avatarUrl,
  displayName,
  className = "",
}: {
  avatarUrl: string | null;
  displayName: string;
  className?: string;
}) {
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);
  const classes = `player-avatar${className ? ` ${className}` : ""}`;
  const visibleAvatarUrl = avatarUrl && avatarUrl !== failedAvatarUrl
    ? avatarUrl
    : null;

  return visibleAvatarUrl ? (
    <span className={classes}>
      <img
        alt=""
        decoding="async"
        onError={() => setFailedAvatarUrl(visibleAvatarUrl)}
        src={visibleAvatarUrl}
      />
    </span>
  ) : (
    <span aria-hidden="true" className={`${classes} is-fallback`}>
      {Array.from(displayName.trim())[0]?.toLocaleUpperCase("ja-JP") ?? "♠"}
    </span>
  );
}
