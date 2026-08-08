import {
  classifyRateLimitedRequest,
  type RateLimitCategory,
} from "@domain/rate-limiting/classify-rate-limited-request";

const RETRY_AFTER_SECONDS = 60;

export async function enforceWriteRateLimit(
  request: Request,
  env: Cloudflare.Env,
): Promise<Response | null> {
  const url = new URL(request.url);
  const category = classifyRateLimitedRequest(request.method, url.pathname);
  if (!category) return null;

  const limiter = limiterFor(category, env);
  const clientKey = request.headers.get("CF-Connecting-IP") ?? "local";
  const { success } = await limiter.limit({ key: clientKey });
  if (success) return null;

  console.warn("Rate limit exceeded", {
    category,
    rayId: request.headers.get("CF-Ray"),
  });
  return new Response(
    "操作が集中しています。1分ほど待ってから、もう一度お試しください。",
    {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8",
        "Retry-After": String(RETRY_AFTER_SECONDS),
      },
    },
  );
}

function limiterFor(
  category: RateLimitCategory,
  env: Cloudflare.Env,
): RateLimit {
  if (category === "organizer-login") {
    return env.ORGANIZER_LOGIN_RATE_LIMITER;
  }
  if (category === "admin-write") return env.ADMIN_WRITE_RATE_LIMITER;
  return env.PARTICIPANT_WRITE_RATE_LIMITER;
}
