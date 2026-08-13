/* Hayat menu — offline cache.
   Bump CACHE below whenever you upload changes, so tablets pick them up. */
const CACHE = "hayat-v22";
const CORE = [
  "./","./index.html","./config.js","./menu-data.js","./lang.js",
  "./assets/icons.js","./assets/logo.png","./assets/mark.png",
  "./assets/icon-192.png","./assets/icon-512.png","./manifest.webmanifest"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (url.origin !== location.origin) return;      // never touch Instagram etc.
  // video: let the browser handle it. Range requests (206) must not go
  // through the cache or seeking breaks on Safari and older Chrome.
  if (/\.(mp4|mov|webm|m4v)$/i.test(url.pathname)) return;
  if (e.request.headers.get("range")) return;

  // network first for the page itself, so edits show up straight away
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).catch(() => caches.match("./index.html")));
    return;
  }
  // JS and CSS: network first, so an update always lands
  if (/\.(js|css|webmanifest)$/.test(url.pathname)) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res && res.status === 200) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }
  // images, video, fonts: cache first, refresh quietly
  e.respondWith(caches.match(e.request).then(hit => {
    const live = fetch(e.request).then(res => {
      if (res && res.status === 200) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
      return res;
    }).catch(() => hit);
    return hit || live;
  }));
});
