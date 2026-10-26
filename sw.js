/* © Geopadel */
const VERSION = "geopadel-b62b41b5b0",
  BASE = [
    "./",
    "index.html",
    "styles.css",
    "config.js",
    "utils.js",
    "acciones.js",
    "i18n.js",
    "landing.js",
    "geopadel.webp",
    "geopadel-512.webp",
    "geopadel-128.webp",
    "fondo.webp",
    "bar.webp",
    "entreno.webp",
    "pista1.webp",
    "pista3.webp",
    "palastest.webp",
    "assets/remixicon/remixicon.css",
    "assets/remixicon/remixicon.woff2",
    "theme-init.js",
    "cookies.js",
  ],
  PANEL = [
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
  ],
  PUBLICO = [
    "reservar.html",
    "reservar.css",
    "reservar.js",
    "tienda.html",
    "tienda-publica.js",
    "privacidad.html",
    "manifest-reservar.webmanifest",
    "assets/supabase.min.js",
    "acciones.js",
    "i18n.js",
  ],
  ARCHIVOS = [...BASE, ...PANEL, ...PUBLICO];
async function detectarModo() {
  try {
    if (self.registration.scope.includes("/panel")) return "panel";
    const e = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: !0,
    });
    if (e.some((e) => e.url.includes("/panel"))) return "panel";
  } catch (e) {}
  return "public";
}
self.addEventListener("install", (e) => {
  e.waitUntil(
    (async () => {
      const e = await detectarModo(),
        t = await caches.open(VERSION),
        n = e === "panel" ? [...BASE, ...PANEL] : [...BASE, ...PUBLICO];
      await Promise.allSettled(n.map((e) => t.add(e)));
      await self.skipWaiting();
    })(),
  );
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const e = await caches.keys();
      await Promise.all(
        e.filter((e) => e !== VERSION).map((e) => caches.delete(e)),
      );
      await self.clients.claim();
    })(),
  );
});
function conTiempo(e, t) {
  return Promise.race([
    e,
    new Promise((e, n) => setTimeout(() => n(new Error("timeout")), t)),
  ]);
}
self.addEventListener("fetch", (e) => {
  const t = e.request;
  if (t.method !== "GET") return;
  const n = new URL(t.url),
    r = n.origin === self.location.origin,
    i = n.hostname === "cdn.jsdelivr.net";
  if (!r && !i) return;
  e.respondWith(
    (async () => {
      const r = await caches.open(VERSION);
      if (i) {
        const n = await r.match(t),
          i = fetch(t)
            .then((e) => {
              if (e && (e.ok || e.type === "opaque")) r.put(t, e.clone());
              return e;
            })
            .catch(() => null);
        if (n) {
          e.waitUntil(i);
          return n;
        }
        return (await i) || Response.error();
      }
      try {
        const n = await conTiempo(fetch(t, { cache: "no-cache" }), 6e3);
        if (n && n.ok) r.put(t, n.clone());
        return n;
      } catch (e) {
        const i = await r.match(t, { ignoreSearch: !0 });
        if (i) return i;
        if (t.mode === "navigate") {
          const e = n.pathname.replace(/\/+$/, "").replace(/\.html$/, ""),
            t = e.endsWith("/reservar")
              ? "reservar.html"
              : e.endsWith("/panel")
                ? "panel.html"
                : e.endsWith("/privacidad")
                  ? "privacidad.html"
                  : "index.html";
          return (
            (await r.match(t)) ||
            (await r.match("index.html")) ||
            Response.error()
          );
        }
        return Response.error();
      }
    })(),
  );
});
self.addEventListener("push", (e) => {
  let t = { title: "Geopadel", body: "Nueva notificación" };
  try {
    if (e.data) t = e.data.json();
  } catch (n) {
    if (e.data) t.body = e.data.text();
  }
  e.waitUntil(
    self.registration.showNotification(t.title || "Geopadel", {
      body: t.body || "",
      icon: "geopadel.webp",
      badge: "geopadel.webp",
      tag: "geopadel-reserva",
      data: { url: t.url || "/panel" },
    }),
  );
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const t = (e.notification.data && e.notification.data.url) || "/panel";
  e.waitUntil(
    (async () => {
      const e = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: !0,
      });
      for (const n of e)
        if (n.url.includes(t) && "focus" in n) return n.focus();
      return self.clients.openWindow(t);
    })(),
  );
});
