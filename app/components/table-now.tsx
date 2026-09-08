import { IconArrowUp, IconBomb, IconCards, IconUsers } from "@tabler/icons-react";

export interface TableNowData {
  allInCount: number;
  bombPotCount: number;
  playerCount: number | null;
  sevenDeuceCount: number;
}

export function TableNow({ data }: { data: TableNowData }) {
  const events = [
    data.allInCount > 0
      ? { key: "all-in", label: "ALL IN", value: data.allInCount, Icon: IconArrowUp }
      : null,
    data.bombPotCount > 0
      ? { key: "bomb-pot", label: "BOMB POT", value: data.bombPotCount, Icon: IconBomb }
      : null,
    data.sevenDeuceCount > 0
      ? { key: "seven-deuce", label: "72o", value: data.sevenDeuceCount, Icon: IconCards }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  return (
    <section aria-label="いまの卓" className="table-now">
      <div className="table-now-heading">
        <span>TABLE NOW</span>
        <small>いまの卓</small>
      </div>
      <div className="table-now-scroller">
        <div className="table-now-item table-now-players">
          <IconUsers aria-hidden="true" stroke={1.7} />
          <span><strong>{data.playerCount ?? "—"}</strong><small>PLAYERS</small></span>
        </div>
        {events.map(({ key, label, value, Icon }) => (
          <div className="table-now-item" key={key}>
            <Icon aria-hidden="true" stroke={1.7} />
            <span><small>{label}</small><strong>{value}</strong></span>
          </div>
        ))}
      </div>
    </section>
  );
}
