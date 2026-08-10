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
