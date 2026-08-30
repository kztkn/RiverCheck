import { beforeEach, describe, expect, it, vi } from "vitest";

const { findGroupByPublicCode, updateOpenGamePlayedAt } = vi.hoisted(() => ({
  findGroupByPublicCode: vi.fn(),
  updateOpenGamePlayedAt: vi.fn(),
}));

vi.mock("@server/repositories/game-schedule-repository.server", () => ({
  updateOpenGamePlayedAt,
}));
vi.mock("@server/repositories/group-repository.server", () => ({
  findGroupByPublicCode,
}));

import { rescheduleOpenGameForGroup } from "@server/services/game-schedule-service.server";

const gameId = "22222222-2222-4222-8222-222222222222";

describe("rescheduleOpenGameForGroup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findGroupByPublicCode.mockResolvedValue({ id: "group-id" });
    updateOpenGamePlayedAt.mockResolvedValue(true);
  });

  it("東京の日付をUTCへ変換して受付中開催を更新する", async () => {
    await expect(
      rescheduleOpenGameForGroup("river-check", gameId, "2026-09-11"),
    ).resolves.toEqual({ ok: true });

    expect(updateOpenGamePlayedAt).toHaveBeenCalledWith(
      "group-id",
      gameId,
      "2026-09-10T15:00:00.000Z",
    );
  });

  it("存在しない日付は更新しない", async () => {
    const result = await rescheduleOpenGameForGroup(
      "river-check",
      gameId,
      "2026-02-30",
    );

    expect(result).toEqual({
      ok: false,
      error: "有効な開催日を入力してください。",
      playedAt: "2026-02-30",
    });
    expect(findGroupByPublicCode).not.toHaveBeenCalled();
    expect(updateOpenGamePlayedAt).not.toHaveBeenCalled();
  });

  it("確定済みなど更新対象外なら失敗として返す", async () => {
    updateOpenGamePlayedAt.mockResolvedValue(false);

    const result = await rescheduleOpenGameForGroup(
      "river-check",
      gameId,
      "2026-09-11",
    );

    expect(result).toEqual({
      ok: false,
      error: "開催日を変更できませんでした。確定済みでないか確認してください。",
      playedAt: "2026-09-11",
    });
  });
});
