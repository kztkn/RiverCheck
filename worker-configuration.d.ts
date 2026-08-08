/// <reference types="@cloudflare/workers-types" />

declare namespace Cloudflare {
  interface Env {
    DATABASE_URL?: string;
    HYPERDRIVE?: Hyperdrive;
  }
}
