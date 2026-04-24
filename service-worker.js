const CACHE_NAME = 'cherry-pos-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './app.js',
  './env.js',
  './manifest.json',
  // Cache Tailwind & FontAwesome scripts (jika browser tidak memblokir CORS, cache first network fallback akan jalan)
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('SW: Pre-caching assets');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Strategi: Cache First, Network Fallback
self.addEventListener('fetch', event => {
  // Hanya proses request GET
  if (event.request.method !== 'GET') return;

  // Lewati request ke Firebase/Firestore agar tidak terjebak di Cache
  if (event.request.url.includes('firestore') || event.request.url.includes('firebase')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      // 1. Return from Cache
      if (cachedResponse) {
        return cachedResponse;
      }
      
      // 2. Network Fallback
      return fetch(event.request).then(networkResponse => {
        // Cache data dinamis secara on-the-fly jika respon sukses
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(err => {
        console.log('Fetch gagal, Anda offline dan tidak ada di cache:', err);
      });
    })
  );
});
