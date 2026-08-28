const BUILD_VERSION = "__BUILD_VERSION__";
const CACHE_PREFIX = "rivercheck-static-";
const CACHE_NAME = `${CACHE_PREFIX}${BUILD_VERSION}`;
const PRECACHE_ENTRIES = __PRECACHE_MANIFEST__;
const PRECACHE_PATHS = new Set(PRECACHE_ENTRIES.map(({ url }) => url));
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(
        PRECACHE_ENTRIES.map(({ url }) =>
          new Request(url, { cache: "reload" }),
        ),
      ),
    ),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all(
      [
        caches.keys().then((names) =>
          Promise.all(
            names
              .filter(
                (name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME,
              )
              .map((name) => caches.delete(name)),
          ),
        ),
        self.clients.claim(),
      ],
    ),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") void self.skipWaiting();
});

self.addEventListener("push", (event) => {
  const payload = readPushPayload(event.data);
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      badge: payload.badge,
      body: payload.body,
      data: payload.data,
      icon: payload.icon,
      tag: payload.tag,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = resolveNotificationUrl(event.notification.data?.url);
  event.waitUntil(openOrFocusWindow(targetUrl));
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () =>
        (await caches.open(CACHE_NAME)).match(OFFLINE_URL),
      ),
    );
    return;
  }

  if (PRECACHE_PATHS.has(url.pathname)) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(url.pathname, { ignoreSearch: true }).then(
          (cached) => cached ?? fetch(request),
        ),
      ),
    );
    return;
  }

  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheStaticAsset(request));
  }
});

async function cacheStaticAsset(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

function readPushPayload(data) {
  const fallback = {
    title: "RiverCheck",
    body: "新しい開催が作成されました。",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: "game-created",
    data: { url: "/" },
  };
  if (!data) return fallback;
  try {
    const value = data.json();
    if (!value || typeof value !== "object") return fallback;
    return {
      title: typeof value.title === "string" ? value.title : fallback.title,
      body: typeof value.body === "string" ? value.body : fallback.body,
      icon: typeof value.icon === "string" ? value.icon : fallback.icon,
      badge: typeof value.badge === "string" ? value.badge : fallback.badge,
      tag: typeof value.tag === "string" ? value.tag : fallback.tag,
      data: value.data && typeof value.data === "object"
        ? value.data
        : fallback.data,
    };
  } catch {
    return fallback;
  }
}

function resolveNotificationUrl(value) {
  if (typeof value !== "string") return self.location.origin;
  try {
    const url = new URL(value, self.location.origin);
    return url.origin === self.location.origin
      ? url.href
      : self.location.origin;
  } catch {
    return self.location.origin;
  }
}

async function openOrFocusWindow(targetUrl) {
  const windowClients = await self.clients.matchAll({
    includeUncontrolled: true,
    type: "window",
  });
  for (const client of windowClients) {
    if ("navigate" in client) await client.navigate(targetUrl);
    return client.focus();
  }
  return self.clients.openWindow(targetUrl);
}
