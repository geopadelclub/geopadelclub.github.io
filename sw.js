/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
const VERSION = 'geopadel-b62b41b5b0';
const BASE = [
    './', 'index.html', 'styles.css', 'config.js', 'utils.js',
    'Geopadel.webp', 'Geopadel-512.webp', 'fondo.webp',
    'assets/remixicon/remixicon.css', 'assets/remixicon/remixicon.woff2'
];
const PANEL = [
    'panel.html', 'core.js', 'auth.js', 'datos.js', 'reservas.js',
    'bar.js', 'caja.js', 'tarifas.js', 'gestion.js',
    'copia-zip.js', 'copia-worker.js', 'copia.js',
    'fichajes.js', 'contrato.js', 'tienda.js', 'ajustes.js',
    'manifest.webmanifest', 'assets/supabase.min.js'
];
const PUBLICO = [
    'reservar.html', 'reservar.css', 'reservar.js', 'reservar-tienda.js',
    'privacidad.html', 'manifest-reservar.webmanifest', 'assets/supabase.min.js'
];
const ARCHIVOS = [...BASE, ...PANEL, ...PUBLICO];
async function detectarModo() {
    try {
        if (self.registration.scope.includes('/panel')) return 'panel';
        const clientes = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        if (clientes.some(c => c.url.includes('/panel'))) return 'panel';
    } catch (e) { }
    return 'public';
}
self.addEventListener('install', e => {
    e.waitUntil((async () => {
        const modo = await detectarModo();
        const cache = await caches.open(VERSION);
        const lista = modo === 'panel' ? [...BASE, ...PANEL] : [...BASE, ...PUBLICO];
        await Promise.allSettled(lista.map(u => cache.add(u)));
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
                const ruta = url.pathname.replace(/\/+$/, '').replace(/\.html$/, '');
                const pagina = ruta.endsWith('/reservar') ? 'reservar.html'
                    : ruta.endsWith('/panel') ? 'panel.html'
                        : ruta.endsWith('/privacidad') ? 'privacidad.html' : 'index.html';
                return (await cache.match(pagina)) || (await cache.match('index.html')) || Response.error();
            }
            return Response.error();
        }
    })());
});