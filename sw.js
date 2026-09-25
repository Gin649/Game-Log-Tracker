// ==============================================================================
// GAME LOG TRACKER — SERVICE WORKER
//
// UPDATE MODEL
//   • Every release: change CACHE_NAME below (v72 -> v73, ...). That one-line
//     change makes sw.js differ byte-for-byte, which is how browsers detect a new
//     version. Nothing else needs to change.
//   • A new version installs quietly in the background and then WAITS. The page
//     (bootstrap.js) notices, shows the gold dot on the menu button, and only
//     when the user taps "Update app" does it send SKIP_WAITING (handled below).
//   • Until then the old version keeps serving its own matching files, so the
//     app never runs a mix of old and new code.
// ==============================================================================

const CACHE_PREFIX = 'gl-tracker-';
const CACHE_NAME = CACHE_PREFIX + 'v76';
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

// INSTALL: download this version's files into its own versioned cache.
// {cache:'reload'} skips the browser's HTTP cache, so a fresh deploy can't
// end up stored under the new version number with stale files (GitHub Pages
// lets browsers cache files for several minutes).
// There is deliberately NO skipWaiting() here — the new version waits for the
// user's go-ahead (see the message handler).
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(ASSETS_TO_CACHE.map((url) => new Request(url, { cache: 'reload' })))
    )
  );
});

// MESSAGE: the page sends this when the user taps "Update app".
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ACTIVATE: delete every OLD version of this app's cache so no stale files
// remain, then take control of open pages. Only caches starting with
// "gl-tracker-" are touched — other apps hosted on the same github.io address
// share this origin's cache storage and must be left alone.
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

// FETCH:
// - Anything not from this app's own origin (RetroAchievements, RAWG,
//   archive.org, etc.) is left entirely alone.
// - Everything else, INCLUDING the HTML page, is served from THIS version's
//   cache only. That keeps index.html, app.js and style.css from ever coming
//   from different versions while an update is waiting. New code arrives only
//   through the update flow above.
// - Files that aren't in the cache go to the network as normal.
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
