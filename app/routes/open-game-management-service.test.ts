import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  deleteOpenGame: vi.fn(),
  updateOpenGameTitle: vi.fn(),
}));

vi.mock("@server/repositories/game-repository.server", () => ({
  deleteOpenGame: mocked.deleteOpenGame,
  insertGame: vi.fn(),
  updateOpenGameTitle: mocked.updateOpenGameTitle,
}));
vi.mock("@server/repositories/group-repository.server", () => ({
  findGroupByPublicCode: vi.fn(),
}));
vi.mock("@server/services/push-notification-service.server", () => ({
  notifyNewGameCreated: vi.fn(),
}));

import {
  removeOpenGameForGroup,
  renameOpenGameForGroup,
} from "@server/services/game-service.server";

describe("open game management service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("開催名を整形して受付中開催へ保存する", async () => {
    mocked.updateOpenGameTitle.mockResolvedValue(true);

    await expect(
      renameOpenGameForGroup(
        "group-1",
        "game-1",
        "  9月のポーカー会  ",
      ),
    ).resolves.toEqual({ ok: true });
    expect(mocked.updateOpenGameTitle).toHaveBeenCalledWith(
      "group-1",
      "game-1",
      "9月のポーカー会",
    );
  });

  it("空の開催名をrepositoryへ渡さず拒否する", async () => {
    await expect(
      renameOpenGameForGroup("group-1", "game-1", "   "),
    ).resolves.toEqual({ ok: false, error: "開催名を入力してください。" });
    expect(mocked.updateOpenGameTitle).not.toHaveBeenCalled();
  });

  it("長すぎる開催名をrepositoryへ渡さず拒否する", async () => {
    await expect(
      renameOpenGameForGroup("group-1", "game-1", "あ".repeat(31)),
    ).resolves.toEqual({
      ok: false,
      error: "開催名は30文字以内で入力してください。",
    });
    expect(mocked.updateOpenGameTitle).not.toHaveBeenCalled();
  });

  it("受付中開催を削除する", async () => {
    mocked.deleteOpenGame.mockResolvedValue(true);

    await expect(
      removeOpenGameForGroup("group-1", "game-1"),
    ).resolves.toEqual({ ok: true });
    expect(mocked.deleteOpenGame).toHaveBeenCalledWith("group-1", "game-1");
  });

  it("更新対象がない場合は画面向けエラーを返す", async () => {
    mocked.updateOpenGameTitle.mockResolvedValue(false);
    mocked.deleteOpenGame.mockResolvedValue(false);

    await expect(
      renameOpenGameForGroup("group-1", "game-1", "変更後"),
    ).resolves.toMatchObject({ ok: false });
    await expect(
      removeOpenGameForGroup("group-1", "game-1"),
    ).resolves.toMatchObject({ ok: false });
  });
});
