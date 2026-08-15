import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  query: vi.fn(),
  withTransaction: vi.fn(),
}));

vi.mock("@server/db/client.server", () => ({
  withTransaction: mocked.withTransaction,
}));

import { applyRebuyAction } from "@server/repositories/rebuy-repository.server";

const input = {
  actorType: "participant" as const,
  actionType: "rebuy" as const,
  commandId: "11111111-1111-4111-8111-111111111111",
  gameId: "22222222-2222-4222-8222-222222222222",
  groupId: "33333333-3333-4333-8333-333333333333",
  target: {
    kind: "participant-id" as const,
    value: "44444444-4444-4444-8444-444444444444",
  },
};

beforeEach(() => {
  vi.resetAllMocks();
  mocked.withTransaction.mockImplementation(async (operation) =>
    operation({ query: mocked.query }),
  );
});

describe("rebuy repository", () => {
  it("結果保存済みでも開催確定前はリバイを記録できる", async () => {
    mocked.query
      .mockResolvedValueOnce({
        rows: [
          {
            id: input.target.value,
            outstanding_rebuy_count: 0,
            settlement_rebuy_count: 0,
            status: "submitted",
            total_rebuy_count: 0,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ id: "55555555-5555-4555-8555-555555555555" }],
      });

    await expect(applyRebuyAction(input)).resolves.toEqual({
      eventId: "55555555-5555-4555-8555-555555555555",
      ok: true,
      state: { outstandingRebuyCount: 1, totalRebuyCount: 1 },
    });
  });

  it("lockedの参加者はリバイを記録できない", async () => {
    mocked.query.mockResolvedValueOnce({
      rows: [
        {
          id: input.target.value,
          outstanding_rebuy_count: 0,
          settlement_rebuy_count: 0,
          status: "locked",
          total_rebuy_count: 0,
        },
      ],
    });

    await expect(applyRebuyAction(input)).resolves.toEqual({
      ok: false,
      reason: "already-submitted",
    });
    expect(mocked.query).toHaveBeenCalledOnce();
  });
});
