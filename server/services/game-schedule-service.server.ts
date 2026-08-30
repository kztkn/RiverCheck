import { updateOpenGamePlayedAt } from "@server/repositories/game-schedule-repository.server";
import { findGroupByPublicCode } from "@server/repositories/group-repository.server";

const JST_OFFSET_MILLISECONDS = 9 * 60 * 60 * 1_000;
const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type RescheduleOpenGameResult =
  | { ok: true }
  | { ok: false; error: string; playedAt: string };

export async function rescheduleOpenGameForGroup(
  publicCode: string,
  gameId: string,
  playedAtValue: string,
): Promise<RescheduleOpenGameResult> {
  const playedAt = parseTokyoDate(playedAtValue);
  if (!playedAt) {
    return {
      ok: false,
      error: "有効な開催日を入力してください。",
      playedAt: playedAtValue,
    };
  }
  if (!UUID_PATTERN.test(gameId)) {
    return {
      ok: false,
      error: "開催を確認できませんでした。画面を更新してください。",
      playedAt: playedAtValue,
    };
  }

  const group = await findGroupByPublicCode(publicCode);
  if (!group) {
    return {
      ok: false,
      error: "グループが見つかりません。",
      playedAt: playedAtValue,
    };
  }

  const updated = await updateOpenGamePlayedAt(group.id, gameId, playedAt);
  return updated
    ? { ok: true }
    : {
        ok: false,
        error: "開催日を変更できませんでした。確定済みでないか確認してください。",
        playedAt: playedAtValue,
      };
}

function parseTokyoDate(value: string): string | null {
  const match = LOCAL_DATE_PATTERN.exec(value.trim());
  if (!match) return null;

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (year < 1_000 || month < 1 || month > 12) return null;

  const utcMilliseconds = Date.UTC(year, month - 1, day) - JST_OFFSET_MILLISECONDS;
  const tokyoTime = new Date(utcMilliseconds + JST_OFFSET_MILLISECONDS);
  if (
    tokyoTime.getUTCFullYear() !== year ||
    tokyoTime.getUTCMonth() !== month - 1 ||
    tokyoTime.getUTCDate() !== day
  ) {
    return null;
  }

  return new Date(utcMilliseconds).toISOString();
}
