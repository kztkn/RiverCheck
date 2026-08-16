import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatSignedBbValue } from "@domain/score/bb-score";
import type { PlayerGameStat } from "@shared-types/player-stats";

interface ChartPoint extends PlayerGameStat {
  dateLabel: string;
}

export function PlayerPerformanceChart({
  games,
}: {
  games: PlayerGameStat[];
}) {
  const data: ChartPoint[] = games.map((game) => ({
    ...game,
    dateLabel: formatShortDate(game.playedAt),
  }));

  return (
    <div className="stats-chart" aria-label="累計損益BBの推移グラフ">
      <ResponsiveContainer height="100%" width="100%">
        <LineChart
          accessibilityLayer
          data={data}
          margin={{ top: 12, right: 10, bottom: 2, left: -20 }}
        >
          <CartesianGrid stroke="rgba(223, 236, 227, 0.055)" vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="dateLabel"
            minTickGap={24}
            tick={{ fill: "#84988e", fontSize: 11 }}
            tickLine={false}
          />
          <YAxis
            axisLine={false}
            tick={{ fill: "#84988e", fontSize: 10 }}
            tickFormatter={(value: number) => `${value}`}
            tickLine={false}
            width={46}
          />
          <Tooltip
            content={({ active, payload }) => {
              const point = payload?.[0]?.payload as ChartPoint | undefined;
              if (!active || !point) return null;
              return (
                <div className="stats-chart-tooltip">
                  <time dateTime={point.playedAt}>
                    {formatLongDate(point.playedAt)}
                  </time>
                  <strong>{point.gameTitle}</strong>
                  <dl>
                    <div>
                      <dt>今回</dt>
                      <dd className={getBbToneClass(point.netBb)}>
                        {formatSignedBbValue(point.netBb)}
                      </dd>
                    </div>
                    <div>
                      <dt>累計</dt>
                      <dd className={getBbToneClass(point.cumulativeNetBb)}>
                        {formatSignedBbValue(point.cumulativeNetBb)}
                      </dd>
                    </div>
                  </dl>
                </div>
              );
            }}
            cursor={{ stroke: "rgba(101, 201, 154, 0.3)", strokeWidth: 1 }}
          />
          <Line
            activeDot={{
              fill: "#f7f3e8",
              r: 5,
              stroke: "#65c99a",
              strokeWidth: 3,
            }}
            dataKey="cumulativeNetBb"
            dot={false}
            isAnimationActive={false}
            name="累計損益BB"
            stroke="#65c99a"
            strokeWidth={3}
            type="monotone"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function formatShortDate(isoDate: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    timeZone: "Asia/Tokyo",
  }).format(new Date(isoDate));
}

function formatLongDate(isoDate: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeZone: "Asia/Tokyo",
  }).format(new Date(isoDate));
}

function getBbToneClass(value: number): string {
  return value > 0 ? "bb-positive" : value < 0 ? "bb-negative" : "bb-neutral";
}
