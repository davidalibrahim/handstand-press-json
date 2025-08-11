
const CACHE = 'hs-json-cache-20250811143403-20250811141016';
const PRECACHE_ASSETS = [
  './','./index.html','./styles.css','./app.js','./workouts.json',
  './manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png',
  './debug.html'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PRECACHE_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => k !== CACHE && caches.delete(k))))
  );
  self.clients.claim();
});

// Stale-while-revalidate for media; fallback to network for others
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/media/')) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(e.request);
      const fetchPromise = fetch(e.request).then(resp => { if (resp && resp.status === 200) cache.put(e.request, resp.clone()); return resp; });
      return cached || fetchPromise;
    })());
    return;
  }
  // default: try cache then network
  e.respondWith(caches.match(e.request).then(res => res || fetch(e.request)));
});

// Allow page to trigger skipWaiting when update is available
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
