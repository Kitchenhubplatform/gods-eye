// God's Eye service worker: installable PWA + offline shell.
// Same-origin only: HTML is network-first, hashed assets / Cesium static files are cache-first,
// bundled datasets are stale-while-revalidate. Cross-origin (tiles, live APIs, streams) and /api are never cached.
const CACHE = 'gods-eye-v2';
const scope = new URL(self.registration.scope);
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([scope.href, new URL('manifest.webmanifest', scope).href])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request; const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== scope.origin || url.pathname.includes('/api/')) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(scope.href, cp)); return r; }).catch(() => caches.match(scope.href)));
    return;
  }
  const isData = url.pathname.includes('/data/') || url.pathname.includes('/tle/');
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(req);
    const net = fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r; });
    if (hit) { if (isData) net.catch(() => {}); return hit; }
    return net;
  }));
});
