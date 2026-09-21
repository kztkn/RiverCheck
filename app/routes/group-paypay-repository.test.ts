import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({ queryDatabase: vi.fn() }));

vi.mock("@server/db/client.server", () => ({
  queryDatabase: mocked.queryDatabase,
}));

import { findGamePaymentAmountForPlayer } from "@server/repositories/group-paypay-repository.server";

describe("findGamePaymentAmountForPlayer", () => {
  beforeEach(() => vi.resetAllMocks());

  it("参加者が支払う最終精算額だけを正数で返す", async () => {
    mocked.queryDatabase.mockResolvedValue({
      rows: [{ cost_share: "2500", game_settlement_amount: "-1500" }],
    });

    await expect(
      findGamePaymentAmountForPlayer("group-1", "game-1", "player-1"),
    ).resolves.toBe(4_000);
  });

  it("受取側はPayPay支払対象外として0を返す", async () => {
    mocked.queryDatabase.mockResolvedValue({
      rows: [{ cost_share: "500", game_settlement_amount: "1500" }],
    });

    await expect(
      findGamePaymentAmountForPlayer("group-1", "game-1", "player-1"),
    ).resolves.toBe(0);
  });

  it("BBレート0相当では従来の会費負担額を返す", async () => {
    mocked.queryDatabase.mockResolvedValue({
      rows: [{ cost_share: "1500", game_settlement_amount: "0" }],
    });

    await expect(
      findGamePaymentAmountForPlayer("group-1", "game-1", "player-1"),
    ).resolves.toBe(1_500);
  });
});
