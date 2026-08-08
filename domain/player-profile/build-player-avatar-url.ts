export function buildPlayerAvatarUrl(input: {
  avatarUpdatedAt: string | null;
  groupCode: string;
  groupPlayerId: string;
}): string | null {
  return input.avatarUpdatedAt
    ? `/g/${input.groupCode}/players/${input.groupPlayerId}/avatar?v=${encodeURIComponent(input.avatarUpdatedAt)}`
    : null;
}
