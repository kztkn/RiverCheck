import { describe, it, expect } from "vitest";
import {
  seasonFor,
  availableSeasons,
  rankSeason,
  seasonAwards,
} from "./season";
import type { PlayerStatsRankingRow } from "../../types/player-stats";
describe("seasons", () => {
  it("2026 is one season; future years use JST half-years", () => {
    expect(seasonFor(2026, 2)).toEqual(seasonFor(2026));
    expect(seasonFor(2026).startAt).toBe("2026-06-18T15:00:00.000Z");
    expect(availableSeasons(new Date("2026-12-31T14:59:59Z"))[0].key).toBe(
      "2026",
    );
    expect(availableSeasons(new Date("2026-12-31T15:00:00Z"))[0].key).toBe(
      "2027-s1",
    );
    expect(availableSeasons(new Date("2027-06-30T15:00:00Z"))[0].key).toBe(
      "2027-s2",
    );
    expect(availableSeasons(new Date("2027-06-30T14:59:59Z"))[0].key).toBe(
      "2027-s1",
    );
    expect(availableSeasons(new Date("2027-12-31T15:00:00Z"))[0].key).toBe(
      "2028-s1",
    );
  });
  it("total BB ties ignore averages; competition ranks and participation overlap", () => {
    const rows = [
      ["a", 120, 60],
      ["b", 120, 20],
      ["c", 80, 80],
      ["d", -100, -100],
    ].map(([id, total, avg]) => ({
      groupPlayerId: id,
      displayName: id,
      totalNetBb: total,
      averageNetBb: avg,
    })) as PlayerStatsRankingRow[];
    const ranked = rankSeason(rows, "total");
    expect(ranked.map((p) => p.rank)).toEqual([1, 1, 3, 4]);
    expect(seasonAwards(seasonFor(2026), 1).map((t) => t.name)).toEqual([
      "2026 卓上の王者",
      "2026 はじまりの一席",
    ]);
    expect(seasonAwards(seasonFor(2026), 3)[0].name).toBe("2026 ブロンズ");
    expect(seasonAwards(seasonFor(2027), 2)[0].name).toBe("2027 S1 準王者");
    expect(seasonAwards(seasonFor(2027), 4)[0].name).toBe("2027 S1 プレイヤー");
  });
});
