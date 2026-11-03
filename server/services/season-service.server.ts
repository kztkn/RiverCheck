import { readRankingPeriodPreference } from "./ranking-period-preference.server";
import { availableSeasons, type Season } from "@domain/season/season";
import { withTransaction } from "@server/db/client.server";
import { findGroupByPublicCode } from "@server/repositories/group-repository.server";
import {
  previewSeason,
  readSeason,
  saveSeason,
  type SeasonPreview,
} from "@server/repositories/season-repository.server";
import { isOrganizerAuthenticated } from "./organizer-auth.server";
export function selectSeason(
  value: string | null,
  now = new Date(),
): Season | null {
  if (value === "all") return null;
  const seasons = availableSeasons(now);
  const selected = value ? seasons.find((s) => s.key === value) : seasons[0];
  if (!selected) throw new Response("Invalid season", { status: 400 });
  return selected;
}
export async function previewVersion(preview: SeasonPreview) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(preview)),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export async function finalizeSeason(
  request: Request,
  groupCode: string,
  key: string,
  version: string,
  now = new Date(),
) {
  if (!(await isOrganizerAuthenticated(request)))
    throw new Response("Forbidden", { status: 403 });
  const season = selectSeason(key, now);
  if (!season || now.getTime() < Date.parse(season.finalizeAt))
    throw new Response("シーズン終了月から確定できます。", { status: 400 });
  const group = await findGroupByPublicCode(groupCode);
  if (!group) throw new Response("Group not found", { status: 404 });
  return withTransaction(async (tx) => {
    await tx.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
    await tx.query("SELECT id FROM groups WHERE id=$1 FOR UPDATE", [group.id]);
    if (await readSeason(group.id, season, tx))
      return { ok: false, error: "このシーズンは確定済みです。" };
    const preview = await previewSeason(group.id, season, tx);
    if (!preview.ranking.length)
      return { ok: false, error: "確定済みの参加実績がありません。" };
    if (version !== (await previewVersion(preview)))
      return {
        ok: false,
        error: "集計が更新されました。画面を更新して再確認してください。",
      };
    await saveSeason(group.id, season, preview, tx);
    return { ok: true, error: null };
  });
}

import { getPlayerStatsRanking } from "./player-stats-service.server";
import { rankSeason } from "@domain/season/season";
import type { PlayerStatsSort } from "@shared-types/player-stats";
export async function getSeasonOverview(
  request: Request,
  code: string,
  sort: PlayerStatsSort,
) {
  const seasons = availableSeasons();
  const selected = selectSeason(
    new URL(request.url).searchParams.get("season") ?? readRankingPeriodPreference(request, code),
  );
  const group = await findGroupByPublicCode(code);
  if (!group) throw new Response("Group not found", { status: 404 });
  const admin = await isOrganizerAuthenticated(request);
  let saved: Awaited<ReturnType<typeof readSeason>> = null;
  let unavailable = false;
  if (selected) {
    try {
      saved = await readSeason(group.id, selected);
    } catch (e) {
      if ((e as { code?: string }).code !== "42P01") throw e;
      unavailable = true;
    }
  }
  if (!selected) {
    const all = await getPlayerStatsRanking(code, sort);
    return {
      ...all!,
      seasons,
      selectedSeason: null,
      finalizedAt: null,
      canFinalize: false,
      preview: null,
      version: "",
      unavailable,
    };
  }
  const preview = saved ?? (await previewSeason(group.id, selected));
  return {
    group,
    sort,
    ranking: rankSeason(preview.ranking, sort),
    seasons,
    selectedSeason: selected,
    finalizedAt: saved?.finalizedAt ?? null,
    canFinalize:
      admin && !saved && !unavailable && Date.now() >= Date.parse(selected.finalizeAt),
    preview:
      admin && !saved
        ? {
            ranking: preview.ranking,
            awards: preview.awards,
            pendingCount: preview.pendingCount,
          }
        : null,
    version: admin && !saved ? await previewVersion(preview) : "",
    unavailable,
  };
}
