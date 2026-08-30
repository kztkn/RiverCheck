import type { GameListItem } from "../../shared-types/game";

const TOKYO_TIME_ZONE = "Asia/Tokyo";

export function orderActiveGamesBySchedule(
  games: GameListItem[],
  now: Date = new Date(),
): GameListItem[] {
  const today = formatTokyoDateKey(now);
  const upcoming: GameListItem[] = [];
  const overdue: GameListItem[] = [];

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

function comparePlayedAtAscending(a: GameListItem, b: GameListItem): number {
  return Date.parse(a.playedAt) - Date.parse(b.playedAt);
}

function comparePlayedAtDescending(a: GameListItem, b: GameListItem): number {
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
