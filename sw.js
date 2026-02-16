const CACHE_NAME = 'dzikir-app-cache-v1';
const urlsToCache = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './dzikir.json',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
    './hafs.woff2'
];

// Event Install: Menyimpan file ke dalam Cache
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Membuka cache dan menyimpan aset');
                return cache.addAll(urlsToCache);
            })
    );
});

// Event Fetch: Mengambil dari cache saat offline
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Jika file ada di cache, gunakan file tersebut. Jika tidak, ambil dari internet.
                return response || fetch(event.request);
            })
    );
});

// Event Activate: Membersihkan cache lama jika ada versi baru
self.addEventListener('activate', (event) => {
    const cacheAllowlist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheAllowlist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});