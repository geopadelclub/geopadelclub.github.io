/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
const COPIA_TABLAS = {
reservas: { etiqueta: 'Reservas', orden: ['fecha', 'id'] },
clientes: { etiqueta: 'Clientes', orden: ['nombre'] },
ventas: { etiqueta: 'Ventas (caja y bar)', orden: ['fecha_hora', 'id'] },
cierres: { etiqueta: 'Cierres de caja', orden: ['fecha', 'id'] },
deudas: { etiqueta: 'Deudas', orden: ['created_at', 'id'] },
limpiezas: { etiqueta: 'Limpiezas', orden: ['created_at', 'id'] },
fichajes: { etiqueta: 'Fichajes', orden: ['created_at', 'id'] },
productos: { etiqueta: 'Catálogo', orden: ['nombre', 'id'] },
tarifas: { etiqueta: 'Tarifas', orden: ['franja'] },
tienda_articulos: { etiqueta: 'Escaparate de la tienda', orden: ['orden', 'id'] },
contratos_jornada: { etiqueta: 'Contratos de jornada', orden: ['created_at', 'id'] },
cierres_historial: { etiqueta: 'Cierres reabiertos (historial)', orden: ['reabierto_at', 'id'] },
consentimientos: { etiqueta: 'Consentimientos de privacidad', orden: ['created_at', 'id'] },
rgpd_log: { etiqueta: 'Registro de borrados RGPD', orden: ['created_at', 'id'] },
usuarios: { etiqueta: 'Usuarios del panel', orden: ['id'] }
};
const COL_PRIVADAS = /codigo|hash|pass|salt|token|secret/i;
const CLAVE_ULTIMA_COPIA = 'gp-ultima-copia';
function aplicarPermisosCopia() {
const permitido = typeof esPersonal === 'function' && esPersonal();
const card = $('cardCopia');
if (card) card.hidden = !permitido;
document.querySelectorAll('[data-exp]').forEach(b => { if (!b.closest('#cardCopia')) b.hidden = !permitido; });
mostrarUltimaCopia();
}
async function obtenerTabla(nombre) {
const cfg = COPIA_TABLAS[nombre];
const intentos = [cfg.orden, cfg.orden.slice(0, 1)];
let ultimoError = null;
for (const orden of intentos) {
const filas = [];
let desde = 0, fallo = false;
while (true) {
let q = supabaseClient.from(nombre).select('*');
orden.forEach(c => { q = q.order(c, { ascending: true }); });
const { data, error } = await q.range(desde, desde + 999);
if (error) { ultimoError = error; fallo = true; break; }
if (!data || !data.length) break;
filas.push(...data);
desde += data.length;
}
if (!fallo) return filas;
}
throw ultimoError;
}
function celdaCSV(v) {
if (v === null || v === undefined) return '';
if (typeof v === 'number') return String(v).replace('.', ',');
if (typeof v === 'boolean') return v ? 'Sí' : 'No';
if (typeof v === 'object') v = JSON.stringify(v);
v = String(v);
if (/^[=@\t\r]/.test(v) || (/^[+-]/.test(v) && !/^[+-]?[\d\s().,-]+$/.test(v))) v = "'" + v;
return /[";\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}
function aCSV(filas) {
const cols = [];
filas.forEach(f => Object.keys(f).forEach(k => { if (!COL_PRIVADAS.test(k) && !cols.includes(k)) cols.push(k); }));
const lineas = [cols.map(celdaCSV).join(';')];
filas.forEach(f => lineas.push(cols.map(c => celdaCSV(f[c])).join(';')));
return lineas.join('\r\n');
}
function sello() {
const d = new Date(), p = n => String(n).padStart(2, '0');
return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function selloHora() {
const d = new Date(), p = n => String(n).padStart(2, '0');
return `${sello()}_${p(d.getHours())}${p(d.getMinutes())}`;
}
async function exportarTabla(nombre, btn) {
if (!COPIA_TABLAS[nombre]) return;
const msg = $('msgCopia');
setBusy(btn, true, '<i class="ri-loader-4-line ri-spin" aria-hidden="true"></i>Exportando...');
try {
const filas = await obtenerTabla(nombre);
const csv = '﻿' + aCSV(filas);
descargarBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `geopadel_${nombre}_${sello()}.csv`);
toast(`${COPIA_TABLAS[nombre].etiqueta}: ${filas.length} filas exportadas`);
} catch (err) {
console.error(err);
const m = 'No se pudo exportar ' + COPIA_TABLAS[nombre].etiqueta.toLowerCase() + ': ' + (err.message || err);
toast(m, 'err');
if (msg) { msg.style.color = 'var(--red)'; msg.innerText = m; }
} finally { setBusy(btn, false); }
}
const TABLA_CRC = (() => {
const t = new Uint32Array(256);
for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
return t;
})();
function crc32(u8) {
let c = 0xFFFFFFFF;
for (let i = 0; i < u8.length; i++) c = TABLA_CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
return (c ^ 0xFFFFFFFF) >>> 0;
}
function crearZip(archivos) {
const enc = new TextEncoder(), partes = [], central = [];
const d = new Date();
const hora = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
const fecha = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
let offset = 0;
archivos.forEach(f => {
const nombre = enc.encode(f.nombre), size = f.datos.length, crc = crc32(f.datos);
const lh = new DataView(new ArrayBuffer(30));
lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
lh.setUint16(10, hora, true); lh.setUint16(12, fecha, true); lh.setUint32(14, crc, true);
lh.setUint32(18, size, true); lh.setUint32(22, size, true); lh.setUint16(26, nombre.length, true); lh.setUint16(28, 0, true);
partes.push(new Uint8Array(lh.buffer), nombre, f.datos);
const ch = new DataView(new ArrayBuffer(46));
ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
ch.setUint16(12, hora, true); ch.setUint16(14, fecha, true); ch.setUint32(16, crc, true);
ch.setUint32(20, size, true); ch.setUint32(24, size, true); ch.setUint16(28, nombre.length, true);
ch.setUint32(42, offset, true);
central.push(new Uint8Array(ch.buffer), nombre);
offset += 30 + nombre.length + size;
});
const tamCentral = central.reduce((s, c) => s + c.length, 0);
const fin = new DataView(new ArrayBuffer(22));
fin.setUint32(0, 0x06054b50, true); fin.setUint16(8, archivos.length, true); fin.setUint16(10, archivos.length, true);
fin.setUint32(12, tamCentral, true); fin.setUint32(16, offset, true);
return new Blob([...partes, ...central, new Uint8Array(fin.buffer)], { type: 'application/zip' });
}
async function descargarCopiaCompleta() {
const btn = $('btnCopiaZip'), msg = $('msgCopia');
const enc = new TextEncoder();
const archivos = [], resumen = [];
setBusy(btn, true, '<i class="ri-loader-4-line ri-spin" aria-hidden="true"></i>Preparando copia...');
try {
for (const nombre of Object.keys(COPIA_TABLAS)) {
msg.style.color = 'var(--muted)';
msg.innerText = `Descargando ${COPIA_TABLAS[nombre].etiqueta.toLowerCase()}...`;
try {
const filas = await obtenerTabla(nombre);
archivos.push({ nombre: `${nombre}.csv`, datos: enc.encode('﻿' + aCSV(filas)) });
resumen.push(`${nombre}.csv: ${filas.length} filas`);
} catch (err) {
console.error(err);
resumen.push(`${nombre}: NO incluida (${(err && err.message) || err})`);
}
}
if (!archivos.length) throw new Error('No se pudo leer ninguna tabla');
const quien = usuarioSesion ? (usuarioSesion.user || usuarioSesion.nombre) : '';
const leeme = `Copia de seguridad de Geopadel\r\nFecha: ${new Date().toLocaleString('es-ES')}\r\nGenerada por: ${quien}\r\n\r\n${resumen.join('\r\n')}\r\n\r\nLos CSV usan «;» como separador y codificación UTF-8 (se abren con Excel).\r\nNo se incluyen códigos ni claves de clientes.\r\n`;
archivos.push({ nombre: 'LEEME.txt', datos: enc.encode(leeme) });
descargarBlob(crearZip(archivos), `geopadel_copia_${selloHora()}.zip`);
try { localStorage.setItem(CLAVE_ULTIMA_COPIA, new Date().toISOString()); } catch (e) { }
mostrarUltimaCopia();
const fallos = resumen.filter(r => r.includes('NO incluida')).length;
msg.style.color = fallos ? 'var(--amber)' : 'var(--green)';
msg.innerText = fallos ? `Copia descargada, pero ${fallos} tabla(s) no se pudieron incluir (mira LEEME.txt).` : 'Copia completa descargada.';
} catch (err) {
console.error(err);
msg.style.color = 'var(--red)';
msg.innerText = 'No se pudo crear la copia: ' + (err.message || err);
} finally { setBusy(btn, false); }
}
function mostrarUltimaCopia() {
const el = $('copiaUltima');
if (!el) return;
let v = null;
try { v = localStorage.getItem(CLAVE_ULTIMA_COPIA); } catch (e) { }
if (!v) { el.style.color = 'var(--orange-text)'; el.innerText = 'Aún no has descargado ninguna copia en este dispositivo.'; return; }
const dias = Math.floor((Date.now() - new Date(v).getTime()) / 86400000);
el.style.color = dias > 7 ? 'var(--red)' : 'var(--green-text)';
el.innerText = `Última copia en este dispositivo: ${new Date(v).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}${dias > 7 ? ` (hace ${dias} días, conviene hacer otra)` : ''}.`;
}
document.addEventListener('click', e => {
const b = e.target.closest('[data-exp]');
if (b && !b.disabled) exportarTabla(b.dataset.exp, b);
});
$('btnCopiaZip').addEventListener('click', descargarCopiaCompleta);
mostrarUltimaCopia();