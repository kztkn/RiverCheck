export function PlayerAvatar({
  avatarUrl,
  displayName,
  className = "",
}: {
  avatarUrl: string | null;
  displayName: string;
  className?: string;
}) {
  const classes = `player-avatar${className ? ` ${className}` : ""}`;
  return avatarUrl ? (
    <span className={classes}>
      <img alt="" src={avatarUrl} />
    </span>
  ) : (
    <span aria-hidden="true" className={`${classes} is-fallback`}>
      {Array.from(displayName.trim())[0]?.toLocaleUpperCase("ja-JP") ?? "♠"}
    </span>
  );
}
