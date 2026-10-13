/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const eur = n => (Number(n) || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const redondear2 = n => Math.round((Number(n) || 0) * 100) / 100;
function toast(msg, tipo = 'ok', ms = 3500) {
const box = $('toasts');
const el = document.createElement('div');
el.className = 'toast ' + (tipo === 'ok' ? '' : tipo);
el.textContent = msg;
box.appendChild(el);
const dur = tipo === 'err' ? Math.max(ms, 6000) : ms;
setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 260); }, dur);
}
function setBusy(btn, on, txt) {
if (!btn) return;
if (on) { btn.dataset.txt = btn.innerHTML; btn.disabled = true; if (txt) btn.innerHTML = txt; }
else { btn.disabled = false; if (btn.dataset.txt) btn.innerHTML = btn.dataset.txt; }
}
function fechaLocalISO(d = new Date()) {
return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function sumarDiasISO(iso, dias) {
const [y, m, d] = iso.split('-').map(Number);
return new Date(Date.UTC(y, m - 1, d + dias, 12, 0, 0)).toISOString().split('T')[0];
}
function estadoRed() { $('bannerOffline').classList.toggle('show', !navigator.onLine); }
function descargarBlob(blob, nombre) {
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url; a.download = nombre;
document.body.appendChild(a);
a.click();
a.remove();
setTimeout(() => URL.revokeObjectURL(url), 10000);
}
async function leerTodo(construir, pagina = 1000, maximo = 200000) {
const filas = [];
for (let desde = 0; desde < maximo; desde += pagina) {
const { data, error } = await construir().range(desde, desde + pagina - 1);
if (error) return { data: null, error };
if (data && data.length) filas.push(...data);
if (!data || data.length < pagina) break;
}
return { data: filas, error: null };
}