const CACHE_NAME = 'smartreceipts-v1.0.1';
const STATIC_CACHE = 'static-v1.1';
const DYNAMIC_CACHE = 'dynamic-v1';

const STATIC_FILES = [
  '/',
  '/index.html',
  '/offline.html'
];

self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(async (cache) => {
        console.log('[Service Worker] Caching static files');
        for (const file of STATIC_FILES) {
          try {
            await cache.add(file);
          } catch (err) {
            console.warn('[Service Worker] Failed to cache:', file, err.message);
          }
        }
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
            console.log('[Service Worker] Removing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('supabase.co') || 
      event.request.url.includes('googleapis.com') ||
      event.request.url.includes('generativelanguage.googleapis.com') ||
      event.request.url.includes('/api/')) {
    return;
  }

  if (event.request.url.startsWith('chrome-extension')) {
      return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(DYNAMIC_CACHE).then(cache => {
            try {
              cache.put(event.request, responseClone);
            } catch (e) {
              console.warn('[Service Worker] Cache put failed:', e.message);
            }
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request)
          .then(cachedResponse => {
            if (cachedResponse) {
              return cachedResponse;
            }
            try {
              if (event.request.headers.get('accept')?.includes('text/html')) {
                  return caches.match('/offline.html');
              }
            } catch (e) {}
            return caches.match('/index.html');
          });
      })
  );
});
