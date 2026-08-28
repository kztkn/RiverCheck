import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  buildPushHTTPRequest: vi.fn(),
  deleteCurrent: vi.fn(),
  deletePlayer: vi.fn(),
  findPlayer: vi.fn(),
  listGroup: vi.fn(),
  runtimeEnv: {} as Record<string, string>,
  upsertPlayer: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({ env: mocked.runtimeEnv }));
vi.mock("@pushforge/builder", () => ({
  buildPushHTTPRequest: mocked.buildPushHTTPRequest,
}));
vi.mock(
  "@server/repositories/player-push-subscription-repository.server",
  () => ({
    deletePlayerPushSubscription: mocked.deletePlayer,
    deletePlayerPushSubscriptionIfCurrent: mocked.deleteCurrent,
    findPlayerPushSubscription: mocked.findPlayer,
    listGroupPlayerPushSubscriptions: mocked.listGroup,
    upsertPlayerPushSubscription: mocked.upsertPlayer,
  }),
);

import {
  disablePlayerPushSubscription,
  getPlayerPushSettings,
  notifyNewGameCreated,
  savePlayerPushSubscription,
  validatePushSubscription,
} from "@server/services/push-notification-service.server";

const playerId = "11111111-1111-4111-8111-111111111111";
const endpoint = "https://web.push.apple.com/valid-subscription";
const validSubscription = {
  endpoint,
  p256dh: "A".repeat(87),
  auth: "B".repeat(22),
};

describe("push notification service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    Object.keys(mocked.runtimeEnv).forEach(
      (key) => delete mocked.runtimeEnv[key],
    );
    Object.assign(mocked.runtimeEnv, {
      WEB_PUSH_VAPID_PUBLIC_KEY: "C".repeat(87),
      WEB_PUSH_VAPID_PRIVATE_JWK: JSON.stringify({
        crv: "P-256",
        d: "private",
        kty: "EC",
        x: "x",
        y: "y",
      }),
      WEB_PUSH_VAPID_SUBJECT: "https://rivercheck.example.com",
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("Apple・Google・Mozilla・MicrosoftのHTTPS Push先だけを受け入れる", () => {
    for (const trustedEndpoint of [
      endpoint,
      "https://fcm.googleapis.com/fcm/send/example",
      "https://updates.push.services.mozilla.com/wpush/v2/example",
      "https://wns2-am3p.notify.windows.com/w/example",
    ]) {
      expect(
        validatePushSubscription({
          ...validSubscription,
          endpoint: trustedEndpoint,
        }).ok,
      ).toBe(true);
    }
    expect(
      validatePushSubscription({
        ...validSubscription,
        endpoint: "https://example.com/internal-hook",
      }),
    ).toEqual({ ok: false, error: "通知先を確認できませんでした。" });
  });

  it("現在の1端末分を保存し、設定確認ではendpoint自体を返さない", async () => {
    mocked.findPlayer.mockResolvedValue({
      playerId,
      ...validSubscription,
      updatedAt: "2026-08-25T12:00:00.000Z",
    });

    await expect(
      savePlayerPushSubscription(playerId, validSubscription),
    ).resolves.toEqual({ ok: true });
    expect(mocked.upsertPlayer).toHaveBeenCalledWith(
      playerId,
      validSubscription,
    );

    const settings = await getPlayerPushSettings(playerId);
    expect(settings).toMatchObject({
      available: true,
      enabled: true,
      publicKey: "C".repeat(87),
    });
    expect(settings.endpointHash).toMatch(/^[0-9a-f]{64}$/u);
    expect(settings).not.toHaveProperty("endpoint");
  });

  it("VAPID未設定では購読テーブルを読まず準備中として返す", async () => {
    delete mocked.runtimeEnv.WEB_PUSH_VAPID_PRIVATE_JWK;

    await expect(getPlayerPushSettings(playerId)).resolves.toEqual({
      available: false,
      enabled: false,
      endpointHash: null,
      publicKey: null,
    });
    expect(mocked.findPlayer).not.toHaveBeenCalled();
  });

  it("OFFではplayerの通知先を削除する", async () => {
    await disablePlayerPushSubscription(playerId);
    expect(mocked.deletePlayer).toHaveBeenCalledWith(playerId);
  });

  it("新規開催を購読者へ送り、期限切れの現在通知先だけ削除する", async () => {
    mocked.listGroup.mockResolvedValue([
      {
        playerId,
        ...validSubscription,
        updatedAt: "2026-08-25T12:00:00.000Z",
      },
    ]);
    mocked.buildPushHTTPRequest.mockResolvedValue({
      endpoint,
      headers: new Headers(),
      body: new ArrayBuffer(0),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 410 })),
    );

    await notifyNewGameCreated({
      gameId: "22222222-2222-4222-8222-222222222222",
      groupId: "33333333-3333-4333-8333-333333333333",
      groupName: "RiverCheck",
      groupPublicCode: "river-check",
      playedAt: "2026-08-30T00:00:00.000Z",
      title: "8月のポーカー会",
    });

    expect(mocked.buildPushHTTPRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({
          payload: expect.objectContaining({
            body: expect.stringContaining("8月のポーカー会"),
            data: {
              url: "/g/river-check/games/22222222-2222-4222-8222-222222222222",
            },
          }),
        }),
      }),
    );
    expect(mocked.deleteCurrent).toHaveBeenCalledWith(playerId, endpoint);
  });
});
