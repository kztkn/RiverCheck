const TOKYO_TIME_ZONE = "Asia/Tokyo";

type SchedulableGame = {
  playedAt: string;
  status: "draft" | "open" | "finalized";
};

export function orderActiveGamesBySchedule<T extends SchedulableGame>(
  games: T[],
  now: Date = new Date(),
): T[] {
  const today = formatTokyoDateKey(now);
  const upcoming: T[] = [];
  const overdue: T[] = [];

  for (const game of games) {
    if (game.status === "finalized") continue;
    const target = formatTokyoDateKey(new Date(game.playedAt));
    if (target >= today) upcoming.push(game);
    else overdue.push(game);
  }

  upcoming.sort(comparePlayedAtAscending);
  overdue.sort(comparePlayedAtDescending);
  return [...upcoming, ...overdue];
}

function comparePlayedAtAscending<T extends SchedulableGame>(a: T, b: T): number {
  return Date.parse(a.playedAt) - Date.parse(b.playedAt);
}

function comparePlayedAtDescending<T extends SchedulableGame>(a: T, b: T): number {
  return Date.parse(b.playedAt) - Date.parse(a.playedAt);
}

function formatTokyoDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: TOKYO_TIME_ZONE,
  }).formatToParts(date);
  const part = (type: "year" | "month" | "day") =>
    parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
