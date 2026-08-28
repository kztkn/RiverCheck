import { buildPushHTTPRequest } from "@pushforge/builder";
import { env } from "cloudflare:workers";
import {
  deletePlayerPushSubscription,
  deletePlayerPushSubscriptionIfCurrent,
  findPlayerPushSubscription,
  listGameParticipantPushSubscriptions,
  listGroupPlayerPushSubscriptions,
  upsertPlayerPushSubscription,
  type PlayerPushSubscriptionRecord,
} from "@server/repositories/player-push-subscription-repository.server";
import { hashToken } from "@server/services/token.server";

const BASE64_URL_PATTERN = /^[A-Za-z0-9_-]+={0,2}$/u;
const TRUSTED_PUSH_HOST_SUFFIXES = [
  "push.apple.com",
  "push.apple.com.cn",
  "fcm.googleapis.com",
  "push.services.mozilla.com",
  "notify.windows.com",
] as const;

interface WebPushRuntimeEnv {
  WEB_PUSH_VAPID_PUBLIC_KEY?: string;
  WEB_PUSH_VAPID_PRIVATE_JWK?: string;
  WEB_PUSH_VAPID_SUBJECT?: string;
}

export interface PlayerPushSettings {
  available: boolean;
  enabled: boolean;
  endpointHash: string | null;
  publicKey: string | null;
}

export type SavePushSubscriptionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function getPlayerPushSettings(
  playerId: string,
): Promise<PlayerPushSettings> {
  const config = readWebPushConfig();
  if (!config) {
    return {
      available: false,
      enabled: false,
      endpointHash: null,
      publicKey: null,
    };
  }
  const subscription = await findPlayerPushSubscription(playerId);
  return {
    available: config !== null,
    enabled: subscription !== null,
    endpointHash: subscription
      ? await hashToken(subscription.endpoint)
      : null,
    publicKey: config.publicKey,
  };
}

export async function savePlayerPushSubscription(
  playerId: string,
  input: { endpoint: string; p256dh: string; auth: string },
): Promise<SavePushSubscriptionResult> {
  if (!readWebPushConfig()) {
    return {
      ok: false,
      error: "通知機能の準備が完了していません。",
    };
  }
  const validation = validatePushSubscription(input);
  if (!validation.ok) return validation;
  await upsertPlayerPushSubscription(playerId, validation.subscription);
  return { ok: true };
}

export async function disablePlayerPushSubscription(
  playerId: string,
): Promise<void> {
  await deletePlayerPushSubscription(playerId);
}

export async function notifyNewGameCreated(input: {
  gameId: string;
  groupId: string;
  groupName: string;
  groupPublicCode: string;
  playedAt: string;
  title: string;
}): Promise<void> {
  const config = readWebPushConfig();
  if (!config) return;
  const subscriptions = await listGroupPlayerPushSubscriptions(input.groupId);
  if (subscriptions.length === 0) return;

  const results = await Promise.allSettled(
    subscriptions.map((subscription) =>
      sendGameCreatedNotification(config, subscription, input),
    ),
  );
  const rejectedCount = results.filter(
    (result) => result.status === "rejected",
  ).length;
  if (rejectedCount > 0) {
    console.warn("Some game-created push notifications failed", {
      attemptedCount: subscriptions.length,
      gameId: input.gameId,
      rejectedCount,
    });
  }
}

export async function notifyGameFinalized(input: {
  gameId: string;
  groupId: string;
  groupName: string;
  groupPublicCode: string;
  playedAt: string;
  title: string;
}): Promise<void> {
  const config = readWebPushConfig();
  if (!config) return;
  const subscriptions = await listGameParticipantPushSubscriptions(
    input.groupId,
    input.gameId,
  );
  if (subscriptions.length === 0) return;

  const results = await Promise.allSettled(
    subscriptions.map((subscription) =>
      sendGameFinalizedNotification(config, subscription, input),
    ),
  );
  const rejectedCount = results.filter(
    (result) => result.status === "rejected",
  ).length;
  if (rejectedCount > 0) {
    console.warn("Some game-finalized push notifications failed", {
      attemptedCount: subscriptions.length,
      gameId: input.gameId,
      rejectedCount,
    });
  }
}

export function validatePushSubscription(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
}):
  | {
      ok: true;
      subscription: { endpoint: string; p256dh: string; auth: string };
    }
  | { ok: false; error: string } {
  const endpoint = input.endpoint.trim();
  const p256dh = input.p256dh.trim();
  const auth = input.auth.trim();
  let endpointUrl: URL;
  try {
    endpointUrl = new URL(endpoint);
  } catch {
    return { ok: false, error: "通知先を確認できませんでした。" };
  }
  if (
    endpoint.length > 2_048 ||
    endpointUrl.protocol !== "https:" ||
    !isTrustedPushHost(endpointUrl.hostname)
  ) {
    return { ok: false, error: "通知先を確認できませんでした。" };
  }
  if (
    p256dh.length < 40 ||
    p256dh.length > 256 ||
    auth.length < 16 ||
    auth.length > 128 ||
    !BASE64_URL_PATTERN.test(p256dh) ||
    !BASE64_URL_PATTERN.test(auth)
  ) {
    return { ok: false, error: "通知用の鍵を確認できませんでした。" };
  }
  return { ok: true, subscription: { endpoint, p256dh, auth } };
}

async function sendGameCreatedNotification(
  config: WebPushConfig,
  subscription: PlayerPushSubscriptionRecord,
  game: {
    gameId: string;
    groupName: string;
    groupPublicCode: string;
    playedAt: string;
    title: string;
  },
): Promise<void> {
  const request = await buildPushHTTPRequest({
    privateJWK: config.privateJwk,
    subscription: {
      endpoint: subscription.endpoint,
      keys: { auth: subscription.auth, p256dh: subscription.p256dh },
    },
    message: {
      adminContact: config.subject,
      options: {
        ttl: 24 * 60 * 60,
        topic: game.gameId.replaceAll("-", ""),
        urgency: "normal",
      },
      payload: {
        title: `${game.groupName}｜新しい開催`,
        body: `${formatTokyoDate(game.playedAt)}「${game.title}」の参加受付が始まりました 🃏`,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: `game-created:${game.gameId}`,
        data: {
          url: `/g/${encodeURIComponent(game.groupPublicCode)}/games/${game.gameId}`,
        },
      },
    },
  });
  const response = await fetch(request.endpoint, {
    method: "POST",
    headers: request.headers,
    body: request.body,
  });
  if (response.ok) return;
  if (response.status === 404 || response.status === 410) {
    await deletePlayerPushSubscriptionIfCurrent(
      subscription.playerId,
      subscription.endpoint,
    );
    return;
  }
  throw new Error(`Push service returned ${response.status}`);
}

async function sendGameFinalizedNotification(
  config: WebPushConfig,
  subscription: PlayerPushSubscriptionRecord,
  game: {
    gameId: string;
    groupName: string;
    groupPublicCode: string;
    playedAt: string;
    title: string;
  },
): Promise<void> {
  const request = await buildPushHTTPRequest({
    privateJWK: config.privateJwk,
    subscription: {
      endpoint: subscription.endpoint,
      keys: { auth: subscription.auth, p256dh: subscription.p256dh },
    },
    message: {
      adminContact: config.subject,
      options: {
        ttl: 24 * 60 * 60,
        topic: game.gameId.replaceAll("-", ""),
        urgency: "normal",
      },
      payload: {
        title: `${game.groupName}｜結果確定`,
        body: `${formatTokyoDate(game.playedAt)}「${game.title}」の結果が確定しました 🃏`,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: `game-finalized:${game.gameId}`,
        data: {
          url: `/g/${encodeURIComponent(game.groupPublicCode)}/games/${game.gameId}`,
        },
      },
    },
  });
  const response = await fetch(request.endpoint, {
    method: "POST",
    headers: request.headers,
    body: request.body,
  });
  if (response.ok) return;
  if (response.status === 404 || response.status === 410) {
    await deletePlayerPushSubscriptionIfCurrent(
      subscription.playerId,
      subscription.endpoint,
    );
    return;
  }
  throw new Error(`Push service returned ${response.status}`);
}

interface WebPushConfig {
  publicKey: string;
  privateJwk: string;
  subject: `mailto:${string}` | `https://${string}`;
}

function readWebPushConfig(): WebPushConfig | null {
  const runtimeEnv = env as WebPushRuntimeEnv;
  const publicKey = runtimeEnv.WEB_PUSH_VAPID_PUBLIC_KEY?.trim();
  const privateJwk = runtimeEnv.WEB_PUSH_VAPID_PRIVATE_JWK?.trim();
  const subject = runtimeEnv.WEB_PUSH_VAPID_SUBJECT?.trim();
  if (!publicKey || !privateJwk || !subject) return null;
  if (!BASE64_URL_PATTERN.test(publicKey)) return null;
  if (!subject.startsWith("mailto:") && !subject.startsWith("https://")) {
    return null;
  }
  try {
    const parsed = JSON.parse(privateJwk) as JsonWebKey;
    if (
      parsed.kty !== "EC" ||
      parsed.crv !== "P-256" ||
      !parsed.x ||
      !parsed.y ||
      !parsed.d
    ) {
      return null;
    }
  } catch {
    return null;
  }
  return {
    publicKey,
    privateJwk,
    subject: subject as WebPushConfig["subject"],
  };
}

function isTrustedPushHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return TRUSTED_PUSH_HOST_SUFFIXES.some(
    (suffix) => normalized === suffix || normalized.endsWith(`.${suffix}`),
  );
}

function formatTokyoDate(playedAt: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    timeZone: "Asia/Tokyo",
  }).format(new Date(playedAt));
}
