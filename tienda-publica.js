/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
const sb =
  window.supabase && window.supabase.createClient
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      })
    : null;

const TIENDA_CACHE_MS = 60000;
let tiendaCache = { t: 0, lista: null };
let tiendaReq = 0;
function tiendaFoto(path) {
  return path && sb
    ? sb.storage.from("tienda").getPublicUrl(path).data.publicUrl
    : "";
}
function tiendaTarjeta(a) {
  const foto = tiendaFoto(a.foto_path);
  const img = foto
    ? `<img src="${esc(foto)}" alt="${esc(a.titulo)}" loading="lazy" decoding="async" width="400" height="400">`
    : '<span class="tienda-sin-foto" aria-hidden="true"><i class="ri-shopping-bag-3-line"></i></span>';
  const abre = foto
    ? ` data-foto-id="${esc(a.id)}" role="button" tabindex="0" aria-label="Ver foto de ${esc(a.titulo)} más grande"`
    : "";
  return `<article class="tienda-card${foto ? " con-foto" : ""}"${abre}><div class="tienda-foto">${img}</div><div class="tienda-info"><h3>${esc(a.titulo)}</h3>${a.descripcion ? `<p>${esc(a.descripcion)}</p>` : ""}<div class="tienda-precio">${eur(a.precio)}</div></div></article>`;
}
function dibujarTienda(lista) {
  const g = $("tiendaGrid");
  if (!lista.length) {
    g.innerHTML =
      '<p class="cl-empty">Ahora mismo no hay artículos en la tienda. Pregunta en el club.</p>';
    return;
  }
  g.innerHTML = lista.map(tiendaTarjeta).join("");
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
    if (!sb) throw new Error("Sin conexión");
    const { data, error } = await sb
      .from("tienda_articulos")
      .select("id, titulo, descripcion, precio, foto_path")
      .eq("visible", true)
      .order("orden", { ascending: true })
      .order("created_at", { ascending: true });
    if (mi !== tiendaReq) return;
    if (error) throw error;
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
    const card = e.target.closest(".tienda-card[data-foto-id]");
    if (card) abrirDesdeTarjeta(card);
  });
  $("tiendaGrid").addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const card = e.target.closest(".tienda-card[data-foto-id]");
    if (card && e.target === card) {
      e.preventDefault();
      abrirDesdeTarjeta(card);
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") cerrarVisor();
  });
}
