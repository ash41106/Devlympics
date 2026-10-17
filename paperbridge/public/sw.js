// Kaagaz offline shell: the ASHA app opens with zero signal; pages queue on the phone and sync when signal returns.
const CACHE = "kaagaz-v1";
const SHELL = ["/field.html", "/styles.css", "/motion.css", "/site.css", "/fx.css", "/fx.js", "/theme.css", "/nav.js", "/voice.js",
  "/logo.svg", "/icon-192.png", "/sample1.png", "/sample2.png", "/manifest.webmanifest"];
self.addEventListener("install", (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.pathname.startsWith("/api/")) return; // live data always goes to the network
  // Network first (always fresh when online), cache as the offline fallback; fonts/CDN cached as they are used.
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok && (u.origin === location.origin || /fonts\.(googleapis|gstatic)\.com|cdnjs/.test(u.host))) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((m) => m || caches.match("/field.html"))));
});
