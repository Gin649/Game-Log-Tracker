// Update model: bump CACHE_NAME each release so sw.js changes byte-for-byte and browsers
// see a new version. The new worker installs in the background and waits; bootstrap.js
// shows the gold dot, and "Update app" sends SKIP_WAITING. Until then the old version
// keeps serving its own files, so old and new code never mix.

const CACHE_PREFIX = 'gl-tracker-';
const CACHE_NAME = CACHE_PREFIX + 'v107';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './css/style.css',
  './js/bootstrap.js',
  './js/storage.js',
  './js/install.js',
  './js/state.js',
  './js/ra-api.js',
  './js/achievements.js',
  './js/cheats.js',
  './js/walkthroughs.js',
  './js/imported-files.js',
  './js/manual-games.js',
  './js/rawg.js',
  './js/views.js',
  './js/game-modal.js',
  './js/add-game.js',
  './js/social.js',
  './js/settings.js',
  './js/sync.js',
  './js/gestures.js',
  './js/menu.js',
  './js/startup.js',
  './js/rom-patcher.js',
  './js/guides.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
  './apple-touch-icon.png'
];

// Install: cache this version's files in its own cache. cache:'reload' bypasses the HTTP
// cache so a fresh deploy can't be stored under the new version with stale files (GitHub
// Pages lets browsers cache for several minutes). No skipWaiting() here on purpose: the
// new version waits for the user.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(ASSETS_TO_CACHE.map((url) => new Request(url, { cache: 'reload' })))
    )
  );
});

// Sent by the page when the user taps "Update app".
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Activate: delete older versions of this app's cache and take control of open pages.
// Only caches with our prefix are touched, since other apps on the same github.io origin
// share cache storage.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch: cross-origin requests (RA, RAWG, archive.org, ...) are left alone. Everything
// else, including the HTML, is served from this version's cache so index.html, the scripts and
// style.css can't come from different versions while an update waits. Anything not
// cached goes to the network.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(serveFromVersionedCache(event.request));
});

async function serveFromVersionedCache(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;
  if (request.mode === 'navigate') {
    const shell = await cache.match('./index.html');
    if (shell) return shell;
  }
  return fetch(request);
}
