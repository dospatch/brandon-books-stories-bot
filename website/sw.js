const CACHE_NAME = "bbs-app-v3";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./assets/bbs-app-icon.svg",
  "./assets/bbs-icon-192.png",
  "./assets/bbs-icon-512.png",
  "./assets/apple-touch-icon.png",
  "./offline.html",
  "./books.json",
  "./changelog.html",
  "./changelog.js",
  "./book-1.html",
  "./book-2.html",
  "./book-3.html",
  "./book-4.html",
  "./book-5.html",
  "./book-6.html",
  "./book-7.html",
  "./privacy.html",
  "./terms.html"
];

self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

async function cacheResponse(request, response) {
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response);
  const keys = await cache.keys();
  const shellUrls = APP_SHELL.map(path => new URL(path, self.location.href).href);
  const runtimeKeys = keys.filter(key => !shellUrls.includes(key.url));
  if (runtimeKeys.length > 80) {
    await Promise.all(runtimeKeys.slice(0, runtimeKeys.length - 80).map(key => cache.delete(key)));
  }
}

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            cacheResponse(request, copy).catch(() => {});
          }
          return response;
        })
        .catch(async () => (await caches.match(request, { ignoreSearch: true })) || (await caches.match(new URL("./offline.html", self.location.href).href)))
    );
    return;
  }

  if (url.pathname.endsWith("/books.json")) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            cacheResponse(request, copy).catch(() => {});
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          cacheResponse(request, copy).catch(() => {});
        }
        return response;
      });
    })
  );
});