import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({ queryDatabase: vi.fn() }));

vi.mock("@server/db/client.server", () => ({
  queryDatabase: mocked.queryDatabase,
}));

import {
  findGamePaymentAmountForPlayer,
  saveGamePayPayRecipientLinkRecord,
  saveGroupPayPayRecipientLinkRecord,
} from "@server/repositories/group-paypay-repository.server";

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

describe("PayPay受取リンクの保存", () => {
  beforeEach(() => vi.resetAllMocks());

  it("開催リンクの受取人UUIDを明示的に型指定して保存する", async () => {
    mocked.queryDatabase.mockResolvedValue({ rowCount: 1, rows: [] });

    await expect(
      saveGamePayPayRecipientLinkRecord(
        "game-group-1",
        "game-1",
        "https://pay.paypay.ne.jp/example",
        "33333333-3333-4333-8333-333333333333",
      ),
    ).resolves.toBe(true);

    const [sql, params] = mocked.queryDatabase.mock.calls[0] ?? [];
    expect(String(sql)).toContain("ELSE $4::UUID");
    expect(params).toEqual([
      "game-1",
      "game-group-1",
      "https://pay.paypay.ne.jp/example",
      "33333333-3333-4333-8333-333333333333",
    ]);
  });

  it("空欄保存では開催リンクと受取人を同時に削除する", async () => {
    mocked.queryDatabase.mockResolvedValue({ rowCount: 1, rows: [] });

    await expect(
      saveGamePayPayRecipientLinkRecord("group-1", "game-1", null, null),
    ).resolves.toBe(true);

    const [sql, params] = mocked.queryDatabase.mock.calls[0] ?? [];
    expect(String(sql)).toContain("WHEN $3::TEXT IS NULL THEN NULL");
    expect(params).toEqual(["game-1", "group-1", null, null]);
  });

  it("グループ既定リンクも受取人UUIDを明示的に型指定する", async () => {
    mocked.queryDatabase.mockResolvedValue({ rowCount: 1, rows: [] });

    await saveGroupPayPayRecipientLinkRecord(
      "group-1",
      "https://pay.paypay.ne.jp/example",
      "33333333-3333-4333-8333-333333333333",
    );

    expect(String(mocked.queryDatabase.mock.calls[0]?.[0])).toContain(
      "ELSE $3::UUID",
    );
  });
});
