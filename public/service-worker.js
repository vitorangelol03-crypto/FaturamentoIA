const CACHE_NAME = 'smartreceipts-v1.0.0';
const STATIC_CACHE = 'static-v1';
const DYNAMIC_CACHE = 'dynamic-v1';

// Arquivos para cache durante a instalação
const STATIC_FILES = [
  '/',
  '/index.html',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/offline.html'
];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('[Service Worker] Caching static files');
        return cache.addAll(STATIC_FILES);
      })
      .then(() => self.skipWaiting())
  );
});

// Ativação do Service Worker
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

// Interceptar requisições (estratégia: Network First, depois Cache)
self.addEventListener('fetch', (event) => {
  // Ignorar requisições do Supabase e Gemini API e API local
  if (event.request.url.includes('supabase.co') || 
      event.request.url.includes('googleapis.com') ||
      event.request.url.includes('generativelanguage.googleapis.com') ||
      event.request.url.includes('/api/')) {
    return;
  }

  // Ignorar chrome-extension schemes
  if (event.request.url.startsWith('chrome-extension')) {
      return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Se a requisição foi bem-sucedida, salvar no cache dinâmico
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(DYNAMIC_CACHE).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Se falhar (offline), tentar buscar do cache
        return caches.match(event.request)
          .then(cachedResponse => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Se não houver cache e for navegação (HTML), retornar página offline
            if (event.request.headers.get('accept').includes('text/html')) {
                return caches.match('/offline.html');
            }
            return caches.match('/index.html');
          });
      })
  );
});