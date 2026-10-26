/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
const VERSION = "geopadel-b62b41b5b0";
const BASE = [
  "./",
  "index.html",
  "styles.css",
  "config.js",
  "utils.js",
  "acciones.js",
  "i18n.js",
  "landing.js",
  "menu.js",
  "geopadel.webp",
  "geopadel-512.webp",
  "geopadel-128.webp",
  "fondo.webp",
  "bar.webp",
  "entreno.webp",
  "pista1.webp",
  "index.css",
  "legal.css",
  "pista3.webp",
  "palastest.webp",
  "assets/remixicon/remixicon.css",
  "assets/remixicon/remixicon.woff2",
  "theme-init.js",
  "cookies.js",
];
const PANEL = [
  "panel.html",
  "core.js",
  "auth.js",
  "datos.js",
  "reservas.js",
  "bar.js",
  "caja.js",
  "tarifas.js",
  "gestion.js",
  "copia-zip.js",
  "copia-worker.js",
  "copia.js",
  "fichajes.js",
  "contrato.js",
  "tienda.js",
  "ajustes.js",
  "resumen.js",
  "acciones.js",
  "notificaciones.js",
  "facturas.js",
  "assets/qrcode.min.js",
  "styles.css",
  "panel.css",
  "print.css",
  "facturas.css",
  "manifest.webmanifest",
  "assets/supabase.min.js",
];
const PUBLICO = [
  "reservar.html",
  "reservar.css",
  "reservar.js",
  "tienda.html",
  "tienda-publica.js",
  "privacidad.html",
  "aviso-legal.html",
  "politica-cookies.html",
  "404.html",
  "manifest-reservar.webmanifest",
  "assets/supabase.min.js",
  "acciones.js",
  "i18n.js",
  "menu.js",
];

async function detectarModo() {
  try {
    if (self.registration.scope.includes("/panel")) return "panel";
    const clientes = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    });
    if (clientes.some((c) => c.url.includes("/panel"))) return "panel";
  } catch (e) {}
  return "public";
}

self.addEventListener("install", (e) => {
  e.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION);
      const lista = [...BASE, ...PANEL, ...PUBLICO];
      await Promise.allSettled(
        lista.map((u) => cache.add(new Request(u, { cache: "reload" }))),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const claves = await caches.keys();
      await Promise.all(
        claves.filter((k) => k !== VERSION).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
});

function conTiempo(promesa, ms) {
  return Promise.race([
    promesa,
    new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)),
  ]);
}

const ES_HTML = (req) =>
  req.mode === "navigate" || req.destination === "document";
const ES_ESTATICO = (req) =>
  ["style", "script", "font", "image", "manifest"].includes(req.destination);

const NO_CACHEAR = (url) =>
  url.hostname.endsWith(".supabase.co") ||
  url.hostname.endsWith(".challenges.cloudflare.com") ||
  url.hostname === "challenges.cloudflare.com" ||
  url.hostname === "www.google.com" ||
  url.hostname === "maps.google.com" ||
  url.hostname === "calendar.google.com";

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (NO_CACHEAR(url)) return;

  const mismoOrigen = url.origin === self.location.origin;
  const esLibreria = url.hostname === "cdn.jsdelivr.net";
  if (!mismoOrigen && !esLibreria) return;

  if (ES_HTML(req)) {
    e.respondWith(
      (async () => {
        const cache = await caches.open(VERSION);
        try {
          const resp = await conTiempo(fetch(req), 5000);
          if (resp && resp.ok) cache.put(req, resp.clone());
          return resp;
        } catch (err) {
          const enCache = await cache.match(req, { ignoreSearch: true });
          if (enCache) return enCache;
          const ruta = url.pathname.replace(/\/+$/, "").replace(/\.html$/, "");
          const candidatos = [
            ruta.endsWith("/reservar") ? "reservar.html" : null,
            ruta.endsWith("/panel") ? "panel.html" : null,
            ruta.endsWith("/tienda") ? "tienda.html" : null,
            ruta.endsWith("/privacidad") ? "privacidad.html" : null,
            "index.html",
          ].filter(Boolean);
          for (const c of candidatos) {
            const m = await cache.match(c);
            if (m) return m;
          }
          return Response.error();
        }
      })(),
    );
    return;
  }

  if (ES_ESTATICO(req) || esLibreria) {
    e.respondWith(
      (async () => {
        const cache = await caches.open(VERSION);
        const enCache = await cache.match(req, { ignoreSearch: true });
        const red = fetch(req)
          .then((resp) => {
            if (resp && (resp.ok || resp.type === "opaque"))
              cache.put(req, resp.clone());
            return resp;
          })
          .catch(() => null);
        if (enCache) {
          e.waitUntil(red);
          return enCache;
        }
        const r = await red;
        return r || Response.error();
      })(),
    );
    return;
  }
});

self.addEventListener("push", (e) => {
  let data = { title: "Geopadel", body: "Nueva notificación" };
  try {
    if (e.data) data = e.data.json();
  } catch (err) {
    if (e.data) data.body = e.data.text();
  }
  e.waitUntil(
    self.registration.showNotification(data.title || "Geopadel", {
      body: data.body || "",
      icon: "geopadel.webp",
      badge: "geopadel.webp",
      tag: "geopadel-reserva",
      data: { url: data.url || "/reservar" },
    }),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil(
    (async () => {
      const clientes = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const c of clientes) {
        if (c.url.includes(url) && "focus" in c) return c.focus();
      }
      return self.clients.openWindow(url);
    })(),
  );
});
