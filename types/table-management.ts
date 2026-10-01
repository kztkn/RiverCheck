export type TablePosition = "MAIN" | "SUB";

export interface TableSeat {
  groupPlayerId: string;
  displayName: string;
  table: TablePosition;
  subEnteredAt: string | null;
}

export interface TableMove {
  id: string;
  displayName: string;
  fromTable: TablePosition;
  toTable: TablePosition;
  recordedAt: string;
}

export interface TableManagementPanel {
  startedAt: string | null;
  canManage: boolean;
  participants: TableSeat[];
  moves: TableMove[];
  serverNow: string;
}
