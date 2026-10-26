/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
const TIENDA_CACHE_MS = 60000;
let tiendaCache = { t: 0, lista: null };
let tiendaReq = 0;
function tiendaFoto(path) {
  return path
    ? `${SUPABASE_URL}/storage/v1/object/public/tienda/${encodeURI(path)}`
    : "";
}
function tiendaTarjeta(a, index) {
  const foto = tiendaFoto(a.foto_path);
  const isLcp = index === 0;
  const imgAttrs = isLcp
    ? 'loading="eager" fetchpriority="high"'
    : 'loading="lazy"';

  const img = foto
    ? `<img src="${esc(foto)}" alt="${esc(a.titulo)}" ${imgAttrs} decoding="async" width="400" height="400">`
    : '<span class="tienda-sin-foto" aria-hidden="true"><i class="ri-shopping-bag-3-line"></i></span>';
  const fotoHtml = foto
    ? `<button type="button" class="tienda-foto-btn" data-foto-id="${esc(a.id)}" aria-label="Ver foto de ${esc(a.titulo)} más grande">${img}</button>`
    : img;
  return `<article class="tienda-card${foto ? " con-foto" : ""}">
    <div class="tienda-foto">${fotoHtml}</div>
    <div class="tienda-info">
      <h2>${esc(a.titulo)}</h2>
      ${a.descripcion ? `<p>${esc(a.descripcion)}</p>` : ""}
      <div class="tienda-precio">${eur(a.precio)}</div>
    </div>
  </article>`;
}
function dibujarTienda(lista) {
  const g = $("tiendaGrid");
  if (!lista.length) {
    g.innerHTML =
      '<p class="cl-empty">Ahora mismo no hay artículos en la tienda. Pregunta en el club.</p>';
    return;
  }
  g.innerHTML = lista.map((a, i) => tiendaTarjeta(a, i)).join("");
}
async function cargarTienda(forzar) {
  const g = $("tiendaGrid");
  if (
    !forzar &&
    tiendaCache.lista &&
    Date.now() - tiendaCache.t < TIENDA_CACHE_MS
  ) {
    dibujarTienda(tiendaCache.lista);
    return;
  }
  if (!tiendaCache.lista) g.innerHTML = '<p class="cl-empty">Cargando...</p>';
  const mi = ++tiendaReq;
  try {
    const qs = new URLSearchParams();
    qs.set("select", "id,titulo,descripcion,precio,foto_path");
    qs.set("visible", "eq.true");
    qs.append("order", "orden.asc");
    qs.append("order", "created_at.asc");
    const res = await fetch(
      SUPABASE_URL + "/rest/v1/tienda_articulos?" + qs.toString(),
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: "Bearer " + SUPABASE_ANON_KEY,
        },
      },
    );
    if (mi !== tiendaReq) return;
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    tiendaCache = { t: Date.now(), lista: data || [] };
    dibujarTienda(tiendaCache.lista);
  } catch (err) {
    if (mi !== tiendaReq) return;
    console.error(err);
    if (tiendaCache.lista) {
      dibujarTienda(tiendaCache.lista);
      return;
    }
    g.innerHTML =
      '<p class="cl-empty">No se pudo cargar la tienda. <button type="button" class="cl-link" id="btnTiendaReintentar">Reintentar</button></p>';
  }
}
let visorEl = null,
  visorPrevFoco = null;
function crearVisor() {
  if (visorEl) return visorEl;
  visorEl = document.createElement("div");
  visorEl.className = "tienda-visor";
  visorEl.hidden = true;
  visorEl.setAttribute("role", "dialog");
  visorEl.setAttribute("aria-modal", "true");
  visorEl.innerHTML =
    '<button type="button" class="tienda-visor-cerrar" aria-label="Cerrar"><i class="ri-close-line" aria-hidden="true"></i></button><figure class="tienda-visor-fig"><img alt=""><figcaption></figcaption></figure>';
  visorEl.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const focusables = visorEl.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (!focusables.length) return;
    const primero = focusables[0];
    const ultimo = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === primero) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault();
      primero.focus();
    }
  });
  visorEl.addEventListener("click", (e) => {
    if (!e.target.closest(".tienda-visor-fig img")) cerrarVisor();
  });
  document.body.appendChild(visorEl);
  return visorEl;
}
function abrirVisor(a) {
  const url = tiendaFoto(a.foto_path);
  if (!url) return;
  const v = crearVisor();
  const img = v.querySelector("img");
  img.src = url;
  img.alt = a.titulo;
  v.querySelector("figcaption").textContent = `${a.titulo} · ${eur(a.precio)}`;
  v.setAttribute("aria-label", a.titulo);
  visorPrevFoco = document.activeElement;
  v.hidden = false;
  document.body.style.overflow = "hidden";
  v.querySelector(".tienda-visor-cerrar").focus();
}
function cerrarVisor() {
  if (!visorEl || visorEl.hidden) return;
  visorEl.hidden = true;
  visorEl.querySelector("img").removeAttribute("src");
  document.body.style.overflow = "";
  if (visorPrevFoco && visorPrevFoco.focus) visorPrevFoco.focus();
}
function abrirDesdeTarjeta(card) {
  const a = (tiendaCache.lista || []).find(
    (x) => String(x.id) === card.dataset.fotoId,
  );
  if (a) abrirVisor(a);
}
document.addEventListener("DOMContentLoaded", () => {
  iniciarTema();
  $("btnTema").addEventListener("click", alternarTema);
  cargarTienda(false);
});
if ($("tiendaGrid")) {
  $("tiendaGrid").addEventListener("click", (e) => {
    if (e.target.closest("#btnTiendaReintentar")) {
      cargarTienda(true);
      return;
    }
    const btn = e.target.closest(".tienda-foto-btn");
    if (btn) abrirDesdeTarjeta(btn);
  });
}
