// sw.js — offline cache + self-updating service worker.
// Bump VERSION on each release to force a clean update (and the "Update"
// prompt). Even without a bump, assets refresh in the background while online.
const VERSION = 'v3';
const CACHE = `viewedtv-${VERSION}`;
const ASSETS = [
    './index.html',
    './app.js',
    './db.js',
    './style.css',
    './manifest.webmanifest',
    './icons/icon-192.png',
    './icons/icon-512.png',
];

self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('activate', event => {
    // Drop old caches. We deliberately do NOT call clients.claim(): the very
    // first load stays uncontrolled (no reload flash); control — and offline —
    // kick in from the next launch. controllerchange then only fires when an
    // update is activated, which is exactly when we want to reload.
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    );
});

// Let the page tell a waiting worker to activate immediately.
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
    const req = event.request;
    if (req.method !== 'GET') return;
    if (new URL(req.url).origin !== self.location.origin) return;

    // Navigations: network-first so a new index.html is picked up promptly,
    // falling back to cache when offline.
    if (req.mode === 'navigate') {
        event.respondWith(
            fetch(req)
                .then(res => {
                    const copy = res.clone();
                    caches.open(CACHE).then(c => c.put('./index.html', copy));
                    return res;
                })
                .catch(() => caches.match('./index.html'))
        );
        return;
    }

    // Assets: stale-while-revalidate — instant from cache, refreshed in the
    // background so the next launch has the latest files.
    event.respondWith(
        caches.match(req).then(cached => {
            const network = fetch(req).then(res => {
                if (res && res.status === 200) {
                    const copy = res.clone();
                    caches.open(CACHE).then(c => c.put(req, copy));
                }
                return res;
            }).catch(() => cached);
            return cached || network;
        })
    );
});

self.addEventListener('message', event => {
    if (event.data && event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({ version: VERSION });
    }
});
