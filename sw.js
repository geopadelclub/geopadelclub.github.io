/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
const VERSION = 'geopadel-66f82526c1';
const ARCHIVOS = ['./', 'index.html', 'panel.html', 'styles.css', 'config.js', 'app.js', 'gestion.js', 'copia.js', 'manifest.webmanifest', 'Geopadel.png', 'fondo.jpg', 'reservar.html', 'reservar.css', 'reservar.js', 'assets/remixicon/remixicon.css', 'assets/remixicon/remixicon.woff2', 'utils.js', 'informes.js', 'privacidad.html', 'manifest-reservar.webmanifest', 'assets/supabase.min.js']; self.addEventListener('install', e => {
e.waitUntil((async () => {
const cache = await caches.open(VERSION);
await Promise.allSettled(ARCHIVOS.map(u => cache.add(u)));
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
function conTiempo(promesa, ms) {
return Promise.race([promesa, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
}
self.addEventListener('fetch', e => {
const req = e.request;
if (req.method !== 'GET') return;
const url = new URL(req.url);
const mismoOrigen = url.origin === self.location.origin;
const esLibreria = url.hostname === 'cdn.jsdelivr.net';
if (!mismoOrigen && !esLibreria) return;
e.respondWith((async () => {
const cache = await caches.open(VERSION);
if (esLibreria) {
const enCache = await cache.match(req);
const red = fetch(req).then(resp => {
if (resp && (resp.ok || resp.type === 'opaque')) cache.put(req, resp.clone());
return resp;
}).catch(() => null);
if (enCache) { e.waitUntil(red); return enCache; }
return (await red) || Response.error();
}
try {
const resp = await conTiempo(fetch(req, { cache: 'no-cache' }), 6000);
if (resp && resp.ok) cache.put(req, resp.clone());
return resp;
} catch (err) {
const enCache = await cache.match(req, { ignoreSearch: true });
if (enCache) return enCache;
if (req.mode === 'navigate') {
const pagina = url.pathname.endsWith('/reservar.html') ? 'reservar.html'
: url.pathname.endsWith('/panel.html') ? 'panel.html'
: url.pathname.endsWith('/privacidad.html') ? 'privacidad.html' : 'index.html';
return (await cache.match(pagina)) || (await cache.match('index.html')) || Response.error();
}
return Response.error();
}
})());
});