/* Only a small reconnect screen is stored. Game models, gameplay responses,
   save data and analytics are never cached by this worker. Bump the version
   when changing a resource in OFFLINE_FILES. Updates wait for existing tabs. */
const CACHE_PREFIX = 'camber-reign-offline-';
const CACHE_NAME = `${CACHE_PREFIX}v1`;
const OFFLINE_URL = '/offline.html';
const OFFLINE_FILES = [
  OFFLINE_URL, '/assets/offline.js', '/assets/logo-compact.svg',
  '/assets/app-icon-192.png', '/assets/app-icon-512.png',
  '/assets/manrope.woff2', '/assets/barlow-condensed-extrabold-italic.woff2',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(
    OFFLINE_FILES.map(path => new Request(path, { cache: 'reload' })),
  )));
  // Do not skip waiting: an update must not take over an active race.
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
    .map(key => caches.delete(key)))));
  // Existing tabs retain their controller until their next navigation.
});

self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(async response => {
      if (response.status < 500) return response;
      return (await caches.match(OFFLINE_URL, { cacheName: CACHE_NAME })) || response;
    }).catch(async () => (await caches.match(OFFLINE_URL, { cacheName: CACHE_NAME }))
      || new Response('Reconnect to the internet to open Camber Reign.', {
        status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })));
    return;
  }
  if (!url.search && OFFLINE_FILES.includes(url.pathname)) {
    event.respondWith(caches.match(request, { cacheName: CACHE_NAME }).then(cached => cached || fetch(request)));
  }
});
