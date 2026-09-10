const CACHE_NAME = 'gl-tracker-v2';
const ASSETS_TO_CACHE = [
'./',
'./index.html',
'./manifest.json',
'./icon-192.png',
'./icon-512.png',
'./icon-512-maskable.png',
'./apple-touch-icon.png'
]; 

// Install Event: Cache interface elements
self.addEventListener('install', (event) => {
event.waitUntil(
caches.open(CACHE_NAME).then((cache) => {
console.log('Caching tracker shell assets');
return cache.addAll(ASSETS_TO_CACHE);
})
);
}); 

// Activate Event: Delete older cache versions
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
})
);
}); 

// Fetch Event: Serve cached assets offline, fetch network copies when online
self.addEventListener('fetch', (event) => {
// Skip caching live data requests to RetroAchievements or RAWG APIs
if (event.request.url.includes('api')) {
return;
} 

event.respondWith(
caches.match(event.request).then((cachedResponse) => {
return cachedResponse || fetch(event.request);
})
);
});

