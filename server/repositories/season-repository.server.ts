import {
  queryDatabase,
  type DatabaseTransaction,
} from "@server/db/client.server";
import { listPlayerStatsRankingSnapshots } from "./player-stats-repository.server";
import {
  seasonRanking,
  seasonAwards,
  type Season,
} from "@domain/season/season";
export async function readSeason(
  groupId: string,
  season: Season,
  tx: DatabaseTransaction = { query: queryDatabase },
) {
  const result = await tx.query<{
    snapshot: SeasonPreview;
    finalized_at: Date;
  }>(
    "SELECT snapshot, finalized_at FROM ranking_seasons WHERE group_id=$1 AND season_key=$2",
    [groupId, season.key],
  );
  return result.rows[0]
    ? {
        ...result.rows[0].snapshot,
        finalizedAt: result.rows[0].finalized_at.toISOString(),
      }
    : null;
}
export async function previewSeason(
  groupId: string,
  season: Season,
  tx: DatabaseTransaction = { query: queryDatabase },
) {
  const snapshots = await listPlayerStatsRankingSnapshots(groupId, season, tx);
  const pending = await tx.query<{ count: number }>(
    "SELECT COUNT(*)::int AS count FROM games WHERE group_id=$1 AND played_at >= $2::timestamptz AND played_at < $3::timestamptz AND status <> 'finalized'",
    [groupId, season.startAt, season.endAt],
  );
  const ranking = seasonRanking(snapshots);
  return {
    snapshots,
    ranking,
    pendingCount: pending.rows[0].count,
    awards: ranking.map((p) => ({
      groupPlayerId: p.groupPlayerId,
      titles: seasonAwards(season, p.rank),
    })),
  };
}
export type SeasonPreview = Awaited<ReturnType<typeof previewSeason>>;
export async function saveSeason(
  groupId: string,
  season: Season,
  preview: SeasonPreview,
  tx: DatabaseTransaction,
) {
  await tx.query(
    "INSERT INTO ranking_seasons (group_id,season_key,start_at,end_at,snapshot) VALUES ($1,$2,$3,$4,$5::jsonb)",
    [
      groupId,
      season.key,
      season.startAt,
      season.endAt,
      JSON.stringify(preview),
    ],
  );
  for (const award of preview.awards)
    for (const title of award.titles) {
      const result = await tx.query<{ id: string }>(
        `INSERT INTO achievements (code,name,description,icon_key,category,is_hidden,sort_order)
      VALUES ($1,$2,$3,'trophy','season',FALSE,400) ON CONFLICT (code) DO UPDATE SET code=EXCLUDED.code RETURNING id`,
        [title.code, title.name, `${season.name}の確定結果で獲得`],
      );
      await tx.query(
        `INSERT INTO player_achievements (group_player_id,achievement_id,metadata,notified_at)
      SELECT id,$3,$4::jsonb,NOW() FROM group_players WHERE id=$1 AND group_id=$2
      ON CONFLICT (group_player_id,achievement_id) DO NOTHING`,
        [
          award.groupPlayerId,
          groupId,
          result.rows[0].id,
          JSON.stringify({
            season: season.key,
            rank: preview.ranking.find(
              (p) => p.groupPlayerId === award.groupPlayerId,
            )?.rank,
          }),
        ],
      );
    }
}
