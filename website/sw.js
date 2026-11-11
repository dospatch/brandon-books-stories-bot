const CACHE_NAME = "bbs-site-shell-v2";
const SHELL = [
  "/",
  "/index.html",
  "/styles.css",
  "/manifest.webmanifest",
  "/app.js",
  "/offline.html",
  "/assets/bbs-app-icon.svg",
  "/assets/bbs-icon-192.png",
  "/assets/bbs-icon-512.png",
  "/assets/apple-touch-icon.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key === "bbs-site-shell-v1").map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {});
        }
        return response;
      }).catch(async () =>
        (await caches.match(request, {ignoreSearch:true})) ||
        (await caches.match("/offline.html")) ||
        Response.error()
      )
    );
    return;
  }

  if (url.pathname === "/books.json") {
    event.respondWith(
      fetch(request, {cache:"no-store"}).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put("/books.json", copy)).catch(() => {});
        }
        return response;
      }).catch(() => caches.match("/books.json"))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok && response.type === "basic") {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {});
      }
      return response;
    }))
  );
});
