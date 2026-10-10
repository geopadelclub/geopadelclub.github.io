const VERSION = 'geopadel-v2';
const NUCLEO = ['./', 'index.html', 'styles.css', 'app.js', 'manifest.webmanifest', 'logo.png', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'];
const OPCIONAL = ['assets/remixicon/remixicon.css', 'assets/remixicon/remixicon.woff2', 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'];

self.addEventListener('install', e => {
    e.waitUntil((async () => {
        const cache = await caches.open(VERSION);
        await cache.addAll(NUCLEO);
        await Promise.allSettled(OPCIONAL.map(u => cache.add(u)));
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', e => {
    e.waitUntil((async () => {
        const claves = await caches.keys();
        await Promise.all(claves.filter(k => k !== VERSION).map(k => caches.delete(k)));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', e => {
    const req = e.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    const mismoOrigen = url.origin === self.location.origin;
    const esLibreria = url.hostname === 'cdn.jsdelivr.net';
    if (!mismoOrigen && !esLibreria) return;

    e.respondWith((async () => {
        const cache = await caches.open(VERSION);
        const enCache = await cache.match(req, { ignoreSearch: mismoOrigen });
        const red = fetch(req).then(resp => {
            if (resp && (resp.ok || resp.type === 'opaque')) cache.put(req, resp.clone());
            return resp;
        }).catch(() => null);
        if (enCache) { e.waitUntil(red); return enCache; }
        const resp = await red;
        if (resp) return resp;
        if (req.mode === 'navigate') return (await cache.match('index.html')) || Response.error();
        return Response.error();
    })());
});
