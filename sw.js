const CACHE_NAME = 'gl-tracker-v25';
const ASSETS_TO_CACHE = [
'./',
'./index.html',
'./manifest.json',
'./icon-192.png',
'./icon-512.png',
'./icon-512-maskable.png',
'./apple-touch-icon.png'
];

// How long the page waits on the network before falling back to the cached
// copy (if there is one). Stops the app hanging on a weak/"lie-fi" connection.
const PAGE_NETWORK_TIMEOUT_MS = 3000;

// Install Event: cache interface assets, and take over immediately instead
// of waiting for every open tab to fully close before this version applies.
// Assets are cached one at a time so a single missing file (e.g. an icon not
// yet pushed to the repo) doesn't fail the whole install the way
// cache.addAll() would — the rest of the app still becomes available offline.
self.addEventListener('install', (event) => {
event.waitUntil(
caches.open(CACHE_NAME).then((cache) => {
console.log('Caching tracker shell assets');
return Promise.all(
ASSETS_TO_CACHE.map((asset) =>
cache.add(asset).catch((err) => {
console.warn('Could not cache', asset, err);
})
)
);
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

// Network-first for the HTML page, with a timeout fallback to the cache.
//  - Only successful (2xx) responses are written to the cache, so a 404/5xx
//    from GitHub Pages mid-deploy can't become the offline fallback.
//  - If the network is slow (> PAGE_NETWORK_TIMEOUT_MS) and a cached copy
//    exists, the cached copy is served right away; the network request keeps
//    going in the background and refreshes the cache for next load.
//  - If there's no cached copy, we simply wait for the network.
function pageNetworkFirst(event) {
const request = event.request;
return new Promise((resolve) => {
let settled = false;
const finish = (response) => {
if (!settled) {
settled = true;
resolve(response);
}
};

const timer = setTimeout(async () => {
const cached = await caches.match(request, { ignoreSearch: true });
if (cached) finish(cached);
}, PAGE_NETWORK_TIMEOUT_MS);

const networkWork = fetch(request)
.then((networkResponse) => {
clearTimeout(timer);
if (networkResponse && networkResponse.ok) {
const responseClone = networkResponse.clone();
event.waitUntil(
caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone)).catch(() => {})
);
}
finish(networkResponse);
})
.catch(async () => {
clearTimeout(timer);
const cached = await caches.match(request, { ignoreSearch: true });
finish(cached || Response.error());
});

// Keep the worker alive until the background fetch/cache update is done,
// even if we already answered from the cache.
event.waitUntil(networkWork);
});
}

// Fetch Event:
// - Anything that isn't a same-origin GET is left alone entirely (RetroAchievements
//   and RAWG API calls, RA media images, fonts, etc.). This is an explicit
//   origin check rather than matching "api" in the URL, which was
//   case-sensitive (RA uses /API/) and could also match unrelated paths.
// - The HTML page uses network-first (see above), so a deployed fix shows up
//   on next load instead of being overridden by a stale cached copy.
// - Static assets (icons, manifest) stay cache-first — they rarely change
//   and this keeps the app fast and available offline.
self.addEventListener('fetch', (event) => {
const request = event.request;
if (request.method !== 'GET') return;

const url = new URL(request.url);
if (url.origin !== self.location.origin) return;

const isPageRequest = request.mode === 'navigate' || url.pathname.endsWith('index.html');

if (isPageRequest) {
event.respondWith(pageNetworkFirst(event));
return;
}

event.respondWith(
caches.match(request).then((cachedResponse) => {
return cachedResponse || fetch(request);
})
);
});
