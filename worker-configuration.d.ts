/// <reference types="@cloudflare/workers-types" />

declare namespace Cloudflare {
  interface Env {
    DATABASE_URL?: string;
    GAME_PHOTOS: R2Bucket;
    HYPERDRIVE?: Hyperdrive;
    ORGANIZER_PIN?: string;
    ORGANIZER_SESSION_SECRET?: string;
    WEB_PUSH_VAPID_PUBLIC_KEY?: string;
    WEB_PUSH_VAPID_PRIVATE_JWK?: string;
    WEB_PUSH_VAPID_SUBJECT?: string;
    ORGANIZER_LOGIN_RATE_LIMITER: RateLimit;
    ADMIN_WRITE_RATE_LIMITER: RateLimit;
    PARTICIPANT_WRITE_RATE_LIMITER: RateLimit;
  }
}
