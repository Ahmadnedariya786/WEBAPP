const CACHE_NAME = 'mehnat-tracker-v1';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/tesseract/worker.min.js',
  '/tesseract/tesseract-core-lstm.wasm.js',
  '/tesseract/tesseract-core-lstm.wasm',
  '/tesseract/lang-data/guj.traineddata',
  '/tesseract/lang-data/eng.traineddata',
  '/tesseract/lang-data/guj.traineddata.gz',
  '/tesseract/lang-data/eng.traineddata.gz'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Precache asset failure (will cache on demand):', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Cache-first for Tesseract assets and local static files
  if (url.pathname.startsWith('/tesseract/') || url.pathname.match(/\.(png|jpg|jpeg|svg|ico|wasm|gz|js|css)$/)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        }).catch(() => cached || new Response('Offline asset unavailable', { status: 503 }));
      })
    );
    return;
  }

  // Network-first with cache fallback for HTML and app navigation
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then((cached) => cached || caches.match('/'));
      })
  );
});
