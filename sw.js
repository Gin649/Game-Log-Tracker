// Update model: bump CACHE_NAME each release so sw.js changes byte-for-byte and browsers
// see a new version. The new worker installs in the background and waits; bootstrap.js
// shows the gold dot, and "Update app" sends SKIP_WAITING. Until then the old version
// keeps serving its own files, so old and new code never mix.

const CACHE_PREFIX = 'gl-tracker-';
const CACHE_NAME = CACHE_PREFIX + 'v170';
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
  './js/subsets.js',
  './js/cheats.js',
  './js/walkthroughs.js',
  './js/imported-files.js',
  './js/manual-games.js',
  './js/igdb.js',
  './js/console-logos.js',
  './js/views.js',
  './js/manuals.js',
  './js/game-details.js',
  './js/play-log.js',
  './js/box-art-pick.js',
  './js/game-modal.js',
  './js/add-game.js',
  './js/social.js',
  './js/settings.js',
  './js/ach-tracker.js',
  './js/sync.js',
  './js/gestures.js',
  './js/device-status.js',
  './js/display-mode.js',
  './js/menu.js',
  './js/pinch-tiles.js',
  './js/gamepad.js',
  './js/gamepad-browser.js',
  './js/startup.js',
  './js/rom-patcher.js',
  './js/guides.js',
  './js/ra-guides.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
  './logos/nintendo.png',
  './logos/playstation.png',
  './logos/xbox.png',
  './logos/consoles/32x.webp',
  './logos/consoles/3do.webp',
  './logos/consoles/3ds.webp',
  './logos/consoles/amiga.webp',
  './logos/consoles/amstradcpc.webp',
  './logos/consoles/android.webp',
  './logos/consoles/appleii.webp',
  './logos/consoles/arcade.webp',
  './logos/consoles/arcadia2001.webp',
  './logos/consoles/atari2600.webp',
  './logos/consoles/atari5200.webp',
  './logos/consoles/atari7800.webp',
  './logos/consoles/c64.webp',
  './logos/consoles/channelf.webp',
  './logos/consoles/colecovision.webp',
  './logos/consoles/dos.webp',
  './logos/consoles/dreamcast.webp',
  './logos/consoles/dsi.webp',
  './logos/consoles/fds.webp',
  './logos/consoles/gamecube.webp',
  './logos/consoles/gamegear.webp',
  './logos/consoles/gb.webp',
  './logos/consoles/gba.webp',
  './logos/consoles/gbc.webp',
  './logos/consoles/genesis.webp',
  './logos/consoles/intellivision.webp',
  './logos/consoles/jaguar.webp',
  './logos/consoles/jaguarcd.webp',
  './logos/consoles/lynx.webp',
  './logos/consoles/mastersystem.webp',
  './logos/consoles/megadrive.webp',
  './logos/consoles/megaduck.webp',
  './logos/consoles/msx.webp',
  './logos/consoles/n64.webp',
  './logos/consoles/nds.webp',
  './logos/consoles/neogeo.webp',
  './logos/consoles/neogeocd.webp',
  './logos/consoles/neogeopocket.webp',
  './logos/consoles/nes.webp',
  './logos/consoles/odyssey2.webp',
  './logos/consoles/pc88.webp',
  './logos/consoles/pcengine.webp',
  './logos/consoles/pcenginecd.webp',
  './logos/consoles/pcfx.webp',
  './logos/consoles/pokemonmini.webp',
  './logos/consoles/ps1.webp',
  './logos/consoles/ps2.webp',
  './logos/consoles/ps3.webp',
  './logos/consoles/ps4.webp',
  './logos/consoles/ps5.webp',
  './logos/consoles/psp.webp',
  './logos/consoles/saturn.webp',
  './logos/consoles/segacd.webp',
  './logos/consoles/sg1000.webp',
  './logos/consoles/snes.webp',
  './logos/consoles/supervision.webp',
  './logos/consoles/switch.webp',
  './logos/consoles/switch2.webp',
  './logos/consoles/vectrex.webp',
  './logos/consoles/virtualboy.webp',
  './logos/consoles/vita.webp',
  './logos/consoles/wii.webp',
  './logos/consoles/wiiu.webp',
  './logos/consoles/windows.webp',
  './logos/consoles/wonderswan.webp',
  './logos/consoles/xbox.webp',
  './logos/consoles/xbox360.webp',
  './logos/consoles/xboxone.webp',
  './logos/consoles/xboxseries.webp',
  './logos/consoles/zxspectrum.webp',
  './apple-touch-icon.png'
];

// Install: cache this version's files in its own cache. cache:'no-cache' makes the browser
// ask the server whether each file changed: it always gets the current file (so a fresh
// deploy can't be stored with stale ones, which GitHub Pages' several-minute browser caching
// would otherwise allow), but an unchanged file comes back as a tiny "304 Not Modified"
// instead of being downloaded again. A release that touches a few files now downloads just
// those, not the whole ~700 KB app. (cache:'reload' re-downloaded everything every time.)
// No skipWaiting() here on purpose: the new version waits for the user.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(ASSETS_TO_CACHE.map((url) => new Request(url, { cache: 'no-cache' })))
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
