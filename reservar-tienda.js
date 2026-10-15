/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
const TIENDA_CACHE_MS = 60000;
let tiendaCache = { t: 0, lista: null };
let tiendaReq = 0;
function tiendaFoto(path) {
return path && sb ? sb.storage.from('tienda').getPublicUrl(path).data.publicUrl : '';
}
function tiendaTarjeta(a) {
const foto = tiendaFoto(a.foto_path);
const img = foto
? `<img src="${esc(foto)}" alt="${esc(a.titulo)}" loading="lazy" decoding="async" width="400" height="400">`
: '<span class="tienda-sin-foto" aria-hidden="true"><i class="ri-shopping-bag-3-line"></i></span>';
return `<article class="tienda-card"><div class="tienda-foto">${img}</div><div class="tienda-info"><h3>${esc(a.titulo)}</h3>${a.descripcion ? `<p>${esc(a.descripcion)}</p>` : ''}<div class="tienda-precio">${eur(a.precio)}</div></div></article>`;
}
function dibujarTienda(lista) {
const g = $('tiendaGrid');
if (!lista.length) { g.innerHTML = '<p class="cl-empty">Ahora mismo no hay artículos en la tienda. Pregunta en el club.</p>'; return; }
g.innerHTML = lista.map(tiendaTarjeta).join('');
}
async function cargarTienda(forzar) {
const g = $('tiendaGrid');
if (!forzar && tiendaCache.lista && Date.now() - tiendaCache.t < TIENDA_CACHE_MS) { dibujarTienda(tiendaCache.lista); return; }
if (!tiendaCache.lista) g.innerHTML = '<p class="cl-empty">Cargando...</p>';
const mi = ++tiendaReq;
try {
if (!sb) throw new Error('Sin conexión con la base de datos');
const { data, error } = await sb.from('tienda_articulos').select('id, titulo, descripcion, precio, foto_path').eq('visible', true).order('orden', { ascending: true }).order('created_at', { ascending: true });
if (mi !== tiendaReq) return;
if (error) throw error;
tiendaCache = { t: Date.now(), lista: data || [] };
dibujarTienda(tiendaCache.lista);
} catch (err) {
if (mi !== tiendaReq) return;
console.error(err);
if (tiendaCache.lista) { dibujarTienda(tiendaCache.lista); return; }
g.innerHTML = '<p class="cl-empty">No se pudo cargar la tienda. <button type="button" class="cl-link" id="btnTiendaReintentar">Reintentar</button></p>';
}
}
function entrarTienda() { cargarTienda(false); }
$('tiendaGrid').addEventListener('click', e => { if (e.target.closest('#btnTiendaReintentar')) cargarTienda(true); });