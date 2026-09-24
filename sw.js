const CACHE_NAME = 'gl-tracker-v63;
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './bootstrap.js',
  './app.js',
  './rom-patcher.js',
  './guides.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
  './apple-touch-icon.png'
];

// Install Event: cache interface assets, and take over immediately instead
// of waiting for every open tab to fully close before this version applies.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Caching tracker shell assets');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: delete older cache versions, and claim existing open
// pages right away so an update applies on next load, not next full restart.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event:
// - Anything not served from this app's own origin (RetroAchievements, RAWG,
//   archive.org, etc.) is left entirely alone — the service worker never
//   touches it. (This replaces an older check that skipped any URL containing
//   "api", which only existed for the old proxy.)
// - The HTML page itself uses network-first, so a fix deployed to GitHub
//   Pages shows up on next load, with the cached copy used only as an
//   offline fallback.
// - Static assets (icons, manifest) stay cache-first — they rarely change
//   and this keeps the app fast and available offline.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (new URL(event.request.url).origin !== self.location.origin) return;

  const isPageRequest = event.request.mode === 'navigate' || event.request.url.endsWith('index.html');

  if (isPageRequest) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          return networkResponse;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request);
    })
  );
});
