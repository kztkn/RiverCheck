import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  findGroupByPublicCode: vi.fn(),
  requireOrganizer: vi.fn(),
  updateGameCostShareReceipt: vi.fn(),
}));

vi.mock("@server/repositories/group-repository.server", () => ({
  findGroupByPublicCode: mocked.findGroupByPublicCode,
}));
vi.mock("@server/services/organizer-auth.server", () => ({
  requireOrganizer: mocked.requireOrganizer,
}));
vi.mock("@server/services/game-cost-share-receipt-service.server", () => ({
  updateGameCostShareReceipt: mocked.updateGameCostShareReceipt,
}));

import { action } from "./game-cost-share-receipts";

const groupPlayerId = "33333333-3333-4333-8333-333333333333";
const gameId = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  vi.resetAllMocks();
  mocked.findGroupByPublicCode.mockResolvedValue({
    id: "11111111-1111-4111-8111-111111111111",
    publicCode: "river-check",
  });
  mocked.updateGameCostShareReceipt.mockResolvedValue({ ok: true });
});

describe("game cost share receipts resource route", () => {
  it("主催者の受取状態を1人単位でJSON保存する", async () => {
    const response = await action(
      actionArgs({ groupPlayerId, received: "yes" }),
    );

    expect(mocked.requireOrganizer).toHaveBeenCalledWith(
      expect.any(Request),
      "river-check",
    );
    expect(mocked.updateGameCostShareReceipt).toHaveBeenCalledWith(
      "11111111-1111-4111-8111-111111111111",
      gameId,
      groupPlayerId,
      true,
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      intent: "update-cost-share-receipt",
      groupPlayerId,
      received: true,
    });
  });

  it("不正な対象IDはDB更新前に拒否する", async () => {
    const response = await action(
      actionArgs({ groupPlayerId: "not-a-uuid", received: "yes" }),
    );

    expect(response.status).toBe(400);
    expect(mocked.updateGameCostShareReceipt).not.toHaveBeenCalled();
  });
});

function actionArgs(values: Record<string, string>) {
  return {
    params: { gameId, groupCode: "river-check" },
    request: new Request(
      `https://example.com/g/river-check/games/${gameId}/cost-share-receipts`,
      {
        body: new URLSearchParams(values),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        method: "POST",
      },
    ),
  } as Parameters<typeof action>[0];
}
