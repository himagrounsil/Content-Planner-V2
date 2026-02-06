const CACHE_NAME = 'himagro-cms-v4-cache';
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

// Install Service Worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
            .then(() => self.skipWaiting())
    );
});

// Activate Service Worker
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

// Fetch strategy: Bypass Service Worker for API calls, Cache First for static assets
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // CRITICAL: Bypass Service Worker for Google Apps Script API
    // This fixes CORS errors and "Failed to convert value to Response"
    if (url.hostname === 'script.google.com') {
        return; // Let the browser handle the request normally
    }

    // Cache first strategy for static assets
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request);
            })
    );
});
