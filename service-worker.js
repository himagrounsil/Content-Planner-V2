const CACHE_NAME = 'himagro-cms-v11-cache';
const STATIC_ASSETS = [
    'Logo/Unsil.png',
    'Logo/Himagro.png',
    'Logo/BluSpeed.png',
    'Logo/Berdampak.png',
    'Logo/Logo Kominfo.png',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap'
];

// File yang harus selalu fresh dari network (tidak boleh stale)
const NETWORK_FIRST_PATTERNS = [
    /index\.html$/,
    /styles\.css$/,
    /script\.js$/,
    /\/$/  // root path
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(STATIC_ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // BYPASS: Google Apps Script API — selalu network
    if (url.hostname === 'script.google.com') {
        event.respondWith(fetch(event.request));
        return;
    }

    // BYPASS: Chrome extensions
    if (url.protocol === 'chrome-extension:') return;

    // NETWORK FIRST untuk index.html, styles.css, script.js
    const isNetworkFirst = NETWORK_FIRST_PATTERNS.some(pattern => pattern.test(url.pathname));
    if (isNetworkFirst) {
        event.respondWith(
            fetch(event.request)
                .then(networkResponse => {
                    // Simpan response terbaru ke cache
                    const clone = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    return networkResponse;
                })
                .catch(() => {
                    // Offline fallback: ambil dari cache jika network gagal
                    return caches.match(event.request);
                })
        );
        return;
    }

    // CACHE FIRST untuk static assets (gambar, font, icon)
    event.respondWith(
        caches.match(event.request)
            .then(cached => {
                if (cached) return cached;
                return fetch(event.request).then(networkResponse => {
                    const clone = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    return networkResponse;
                });
            })
    );
});
