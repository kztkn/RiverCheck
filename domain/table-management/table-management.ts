import type { TableSeat } from "../../types/table-management";

// Equal start times (including the initial allocation) use a stable tie break.
export function orderSubTable(participants: TableSeat[]): TableSeat[] {
  return participants.filter((seat) => seat.table === "SUB").sort((a, b) =>
    Date.parse(a.subEnteredAt!) - Date.parse(b.subEnteredAt!) ||
    a.groupPlayerId.localeCompare(b.groupPlayerId),
  );
}

export function subStayMinutes(subEnteredAt: string, now: number): number {
  return Math.max(0, Math.floor((now - Date.parse(subEnteredAt)) / 60_000));
}

export function validateTableAllocation(currentIds: string[], mainIds: string[], subIds: string[]): boolean {
  const selected = [...mainIds, ...subIds];
  return mainIds.length > 0 && subIds.length > 0 &&
    new Set(selected).size === selected.length &&
    selected.length === currentIds.length &&
    selected.every((id) => currentIds.includes(id));
}
