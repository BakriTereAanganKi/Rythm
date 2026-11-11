// Network-first cache so the app keeps working offline after the first visit.
const CACHE = 'rythm-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      try {
        const res = await fetch(e.request);
        if (res.ok) cache.put(e.request, res.clone());
        return res;
      } catch {
        const hit = await cache.match(e.request);
        if (hit) return hit;
        throw new Error('offline');
      }
    })
  );
});
