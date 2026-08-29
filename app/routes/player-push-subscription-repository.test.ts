import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  queryDatabase: vi.fn(),
}));

vi.mock("@server/db/client.server", () => ({
  queryDatabase: mocked.queryDatabase,
  withTransaction: vi.fn(),
}));

import {
  listGameParticipantPushSubscriptions,
  listGroupPlayerPushSubscriptions,
} from "@server/repositories/player-push-subscription-repository.server";

describe("player push subscription repository", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("新規開催通知は所属中かつ通知ONのplayerだけを取得する", async () => {
    mocked.queryDatabase.mockResolvedValue({ rows: [] });

    await listGroupPlayerPushSubscriptions("group-1");

    const sql = String(mocked.queryDatabase.mock.calls[0]?.[0]);
    expect(sql).toContain("group_player.group_id = $1");
    expect(sql).toContain("group_player.is_active = TRUE");
    expect(sql).toContain("group_player.push_notifications_enabled = TRUE");
  });

  it("結果確定通知は開催参加者かつグループ通知ONのplayerだけを取得する", async () => {
    mocked.queryDatabase.mockResolvedValue({
      rows: [
        {
          player_id: "player-1",
          endpoint: "https://web.push.apple.com/subscription",
          p256dh: "p256dh",
          auth: "auth",
          updated_at: new Date("2026-08-28T00:00:00.000Z"),
        },
      ],
    });

    await expect(
      listGameParticipantPushSubscriptions("group-1", "game-1"),
    ).resolves.toEqual([
      {
        playerId: "player-1",
        endpoint: "https://web.push.apple.com/subscription",
        p256dh: "p256dh",
        auth: "auth",
        updatedAt: "2026-08-28T00:00:00.000Z",
      },
    ]);

    const sql = String(mocked.queryDatabase.mock.calls[0]?.[0]);
    expect(sql).toContain("FROM game_participants AS participant");
    expect(sql).toContain("INNER JOIN player_push_subscriptions AS subscription");
    expect(sql).toContain("participant.game_id = $1");
    expect(sql).toContain("group_player.group_id = $2");
    expect(sql).toContain("group_player.push_notifications_enabled = TRUE");
    expect(mocked.queryDatabase).toHaveBeenCalledWith(expect.any(String), [
      "game-1",
      "group-1",
    ]);
  });
});
