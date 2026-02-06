const CACHE_NAME = 'himagro-cms-v5-cache';
const urlsToCache = [
    './',
    'index.html',
    'styles.css',
    'script.js',
    'Logo/Unsil.png',
    'Logo/Himagro.png',
    'Logo/Kabinet.png',
    'Logo/BluSpeed.png',
    'Logo/Berdampak.png',
    'Logo/Logo Kominfo.png',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
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

    // EXPLICIT BYPASS for Google Apps Script
    if (url.hostname === 'script.google.com') {
        event.respondWith(fetch(event.request));
        return;
    }

    // Cache First for static assets
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
});
