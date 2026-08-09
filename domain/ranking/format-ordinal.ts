export function formatOrdinal(rank: number): string {
  if (!Number.isSafeInteger(rank) || rank < 1) {
    throw new RangeError("rank must be a positive integer");
  }

  const lastTwoDigits = rank % 100;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 13) return `${rank}th`;

  const suffix =
    rank % 10 === 1
      ? "st"
      : rank % 10 === 2
        ? "nd"
        : rank % 10 === 3
          ? "rd"
          : "th";
  return `${rank}${suffix}`;
}
