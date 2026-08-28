import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  findGroup: vi.fn(),
  insertGame: vi.fn(),
  notifyNewGameCreated: vi.fn(),
}));

vi.mock("@server/repositories/game-repository.server", () => ({
  deleteOpenGame: vi.fn(),
  insertGame: mocked.insertGame,
  updateOpenGameTitle: vi.fn(),
}));
vi.mock("@server/repositories/group-repository.server", () => ({
  findGroupByPublicCode: mocked.findGroup,
}));
vi.mock("@server/services/push-notification-service.server", () => ({
  notifyNewGameCreated: mocked.notifyNewGameCreated,
}));

import {
  createGameForGroup,
  type CreateGameFormValues,
} from "@server/services/game-service.server";

const values: CreateGameFormValues = {
  title: "8月のポーカー会",
  playedAt: "2026-08-30",
  initialChips: "20000",
  venueCost: "11300",
  firstPlaceCost: "0",
  secondPlaceCost: "500",
  thirdPlaceCost: "1000",
  previewParticipantCount: "4",
  costShares: ["0", "500", "1000", "9800"],
  sevenDeuceRuleEnabled: true,
  bombPotRuleEnabled: true,
};

describe("game creation notification", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocked.findGroup.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      name: "RiverCheck",
      publicCode: "river-check",
      payPayRecipientLink: null,
      payPayLinkRegisteredAt: null,
    });
    mocked.insertGame.mockResolvedValue(
      "22222222-2222-4222-8222-222222222222",
    );
  });

  it("ゲーム保存後に開催情報を通知serviceへ渡す", async () => {
    const result = await createGameForGroup("river-check", values);

    expect(result).toEqual({
      ok: true,
      gameId: "22222222-2222-4222-8222-222222222222",
    });
    expect(mocked.notifyNewGameCreated).toHaveBeenCalledWith({
      gameId: "22222222-2222-4222-8222-222222222222",
      groupId: "11111111-1111-4111-8111-111111111111",
      groupName: "RiverCheck",
      groupPublicCode: "river-check",
      playedAt: "2026-08-29T15:00:00.000Z",
      title: "8月のポーカー会",
    });
  });

  it("通知失敗でも作成済みゲームを成功として返す", async () => {
    mocked.notifyNewGameCreated.mockRejectedValue(new Error("push failed"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(createGameForGroup("river-check", values)).resolves.toEqual({
      ok: true,
      gameId: "22222222-2222-4222-8222-222222222222",
    });
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to notify players about a new game",
      expect.objectContaining({
        errorType: "Error",
        gameId: "22222222-2222-4222-8222-222222222222",
      }),
    );
    consoleError.mockRestore();
  });
});
