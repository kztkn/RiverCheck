/// <reference types="@cloudflare/workers-types" />

declare namespace Cloudflare {
  interface Env {
    DATABASE_URL?: string;
    HYPERDRIVE?: Hyperdrive;
    ORGANIZER_PIN?: string;
    ORGANIZER_SESSION_SECRET?: string;
  }
}
