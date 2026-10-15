/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
const sb = (window.supabase && window.supabase.createClient)
? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
: null;
const SPIN = '<i class="ri-loader-4-line ri-spin" aria-hidden="true"></i>';
let cfg = { dias_max: 30, cancelar_horas: 24, max_futuras: 4, duraciones: [60, 90, 120], anticipacion_min: 120 };
const sel = { fecha: null, dur: 90, hora: null, precio: 0 };
const flujo = { fase: 'tel', tel: '', codigo: '', nombre: '' };
let cuenta = null;
let slotsDia = [];
let reqHuecos = 0;
function fechaDesdeISO(iso) {
const [y, m, d] = iso.split('-').map(Number);
return new Date(y, m - 1, d, 12);
}
const fechaWeb = iso => fechaBonita(iso, true);
function minutos(h) {
const [a, b] = String(h).split(':').map(Number);
return (a || 0) * 60 + (b || 0);
}
function horaStr(min) {
return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}
function duracionTxt(d) {
const h = Math.floor(d / 60), m = d % 60;
return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
}
async function llamarEdge(accion, args) {
const r = await fetch(SUPABASE_URL + '/functions/v1/reservar-web', {
method: 'POST',
headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY },
body: JSON.stringify({ accion, ...args })
});
let j = null;
try { j = await r.json(); } catch (e) { }
if (!j) throw new Error('Respuesta no válida (' + r.status + ')');
if (j.error === 'db') { const e = new Error(j.message || 'Error de base de datos'); e.code = j.code; throw e; }
return j;
}
let tsId = null, tsToken = '';
function iniciarTurnstile() {
if (!TURNSTILE_SITEKEY || tsId !== null) return;
const box = $('cfTurnstile');
box.hidden = false;
const pintar = () => {
if (tsId !== null || !window.turnstile) return;
tsId = window.turnstile.render('#cfTurnstile', { sitekey: TURNSTILE_SITEKEY, callback: t => { tsToken = t; }, 'expired-callback': () => { tsToken = ''; }, 'error-callback': () => { tsToken = ''; } });
};
if (window.turnstile) pintar();
else {
const s = document.createElement('script');
s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
s.async = true; s.onload = pintar;
document.head.appendChild(s);
}
}
function reiniciarTurnstile() {
tsToken = '';
if (window.turnstile && tsId !== null) { try { window.turnstile.reset(tsId); } catch (e) { } }
}
const RPC_LECTURA = ['web_config', 'web_disponibilidad', 'web_identificar', 'web_mis_reservas'];
async function rpc(fn, args) {
if (!sb) throw new Error('Sin conexión con la base de datos');
const llamar = () => sb.rpc(fn, args || {});
const { data, error } = RPC_LECTURA.includes(fn) ? await conReintento(llamar) : await llamar();
if (error) throw error;
return data;
}
function errorRed(err) {
console.error(err);
toast('No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.', 'err');
}
function motivoTexto(m) {
if (m === 'plazo') return `Solo se puede cancelar con ${cfg.cancelar_horas} h de antelación. Llama al club.`;
if (m === 'tipo') return 'Esta reserva solo se puede cambiar llamando al club.';
if (m === 'pagada') return 'Tiene pagos registrados. Llama al club para cambiarla.';
return 'Llama al club para cambiarla.';
}
function textoError(r) {
const e = r && r.error;
switch (e) {
case 'fecha_invalida': return 'Ese día no está disponible para reservar.';
case 'hora_invalida': return 'Esa hora no está disponible.';
case 'hora_pasada': return 'Esa hora ya no se puede reservar. Elige otra.';
case 'duracion_invalida': return 'La duración elegida no es válida.';
case 'telefono_invalido': return 'Revisa el teléfono.';
case 'nombre_invalido': return 'Escribe tu nombre y apellidos.';
case 'codigo_formato': return 'El código debe tener entre 4 y 30 caracteres.';
case 'codigo_incorrecto': return r.restantes === 1 ? 'Código incorrecto. Te queda 1 intento.' : `Código incorrecto. Te quedan ${r.restantes} intentos.`;
case 'bloqueado': {
const min = Math.max(1, Math.ceil((r.segundos || 0) / 60));
return `Demasiados intentos. Inténtalo de nuevo en ${min < 60 ? min + ' min' : Math.ceil(min / 60) + ' h'}.`;
}
case 'sin_disponibilidad': return 'Ese hueco se acaba de ocupar. Elige otra hora.';
case 'limite_reservas': return `Ya tienes ${r.max} reservas pendientes. Cancela alguna o llama al club.`;
case 'no_encontrada': return 'No se ha encontrado la reserva.';
case 'ambiguo': return 'Hay varios clientes con ese nombre. Entra con tu teléfono.';
case 'faltan_datos': return 'Rellena todos los campos.';
case 'captcha': return 'No hemos podido verificar que eres una persona. Inténtalo de nuevo.';
case 'demasiadas_solicitudes': return 'Demasiados intentos desde tu conexión. Espera unos minutos o llama al club.';
case 'consentimiento': return 'Debes aceptar la política de privacidad para crear tu código.';
case 'cliente_existente': return 'Ya hay un cliente del club con esos datos. Llama al club y te activamos el acceso web.';
case 'deuda_pendiente': return 'Tienes un pago pendiente con el club. Llama al club para resolverlo y poder borrar tus datos.';
case 'no_cancelable': return motivoTexto(r.motivo);
default: return 'No se pudo completar la acción. Inténtalo de nuevo.';
}
}
function cambiarPestana(tab) {
document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
document.querySelectorAll('.app-nav .nav-tab').forEach(el => { el.classList.remove('active'); el.removeAttribute('aria-current'); });
$('tab-' + tab).classList.add('active');
const nav = $('nav-' + tab);
nav.classList.add('active');
nav.setAttribute('aria-current', 'page');
document.title = 'Geopadel · ' + (tab === 'mis' ? 'Mis reservas' : tab === 'tienda' ? 'Tienda' : 'Reserva tu pista');
window.scrollTo({ top: 0 });
if (tab === 'reservar' && sel.fecha) cargarHuecos();
if (tab === 'mis' && cuenta) cargarMisReservas(cuenta.ident, cuenta.codigo);
if (tab === 'tienda' && typeof entrarTienda === 'function') entrarTienda();
}
document.querySelectorAll('.app-nav .nav-tab').forEach(b => b.addEventListener('click', () => cambiarPestana(b.dataset.tab)));
function dibujarDias() {
const hoy = fechaLocalISO();
let html = '';
for (let i = 0; i <= cfg.dias_max; i++) {
const iso = sumarDiasISO(hoy, i), f = fechaDesdeISO(iso);
const sem = i === 0 ? 'hoy' : f.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '');
const mes = f.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '');
html += `<button type="button" class="cl-day" data-fecha="${iso}" aria-pressed="false"><small>${esc(sem)}</small><b>${f.getDate()}</b><small>${esc(mes)}</small></button>`;
}
$('clDias').innerHTML = html;
}
function dibujarDuraciones() {
$('clDur').innerHTML = cfg.duraciones.map(d =>
`<button type="button" class="cl-dur${d === sel.dur ? ' active' : ''}" data-dur="${d}" aria-pressed="${d === sel.dur}">${esc(duracionTxt(d))}</button>`).join('');
}
function seleccionarDia(iso) {
sel.fecha = iso;
sel.hora = null;
document.querySelectorAll('.cl-day').forEach(b => {
const on = b.dataset.fecha === iso;
b.classList.toggle('active', on);
b.setAttribute('aria-pressed', on);
if (on) b.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
});
$('cardDatos').hidden = true;
cargarHuecos();
}
$('clDias').addEventListener('click', e => {
const b = e.target.closest('.cl-day');
if (b) seleccionarDia(b.dataset.fecha);
});
$('clDur').addEventListener('click', e => {
const b = e.target.closest('.cl-dur');
if (!b) return;
sel.dur = parseInt(b.dataset.dur, 10);
sel.hora = null;
$('cardDatos').hidden = true;
dibujarDuraciones();
dibujarHuecos();
});
const antMin = () => Number.isFinite(Number(cfg.anticipacion_min)) ? Number(cfg.anticipacion_min) : 120;
function horaReservable(fechaISO, hora) {
const [y, m, d] = fechaISO.split('-').map(Number);
const mins = minutos(hora);
const inicio = new Date(y, m - 1, d, Math.floor(mins / 60), mins % 60);
return inicio.getTime() - Date.now() >= antMin() * 60000;
}
function textoAntelacion() {
return `Las reservas se hacen con ${duracionTxt(antMin())} de antelación como mínimo.`;
}
async function cargarHuecos() {
const cont = $('clSlots');
const fecha = sel.fecha;
const mi = ++reqHuecos;
cont.innerHTML = '<p class="cl-empty">Buscando huecos...</p>';
try {
const r = await rpc('web_disponibilidad', { p_fecha: fecha });
if (mi !== reqHuecos) return;
if (!r || !r.ok) { slotsDia = []; cont.innerHTML = `<p class="cl-empty">${esc(textoError(r))}</p>`; return; }
slotsDia = r.slots || [];
dibujarHuecos();
} catch (err) {
if (mi !== reqHuecos) return;
console.error(err);
cont.innerHTML = '<p class="cl-empty">No se pudo cargar la disponibilidad. <button type="button" class="cl-link" id="btnReintentar">Reintentar</button></p>';
}
}
function dibujarHuecos() {
const cont = $('clSlots');
const libres = slotsDia
.map(s => ({ hora: s.hora, op: (s.opciones || []).find(o => o.dur === sel.dur) }))
.filter(x => x.op);
const lista = libres.filter(x => horaReservable(sel.fecha, x.hora));
if (sel.hora && !lista.some(x => x.hora === sel.hora)) { sel.hora = null; $('cardDatos').hidden = true; }
if (!lista.length) {
cont.innerHTML = libres.length
? `<p class="cl-empty">${esc(textoAntelacion())} Para reservar con menos antelación, llama al club.</p>`
: `<p class="cl-empty">No quedan huecos de ${esc(duracionTxt(sel.dur))} este día. Prueba otro día o duración.</p>`;
return;
}
cont.innerHTML = lista.map(x =>
`<button type="button" class="cl-slot${x.hora === sel.hora ? ' active' : ''}" data-hora="${esc(x.hora)}" data-precio="${esc(x.op.precio)}" aria-pressed="${x.hora === sel.hora}">${esc(x.hora)}<span>${eur(x.op.precio)}</span></button>`).join('');
}
$('clSlots').addEventListener('click', e => {
if (e.target.closest('#btnReintentar')) { cargarHuecos(); return; }
const b = e.target.closest('.cl-slot');
if (!b) return;
sel.hora = b.dataset.hora;
sel.precio = Number(b.dataset.precio) || 0;
dibujarHuecos();
mostrarDatos();
});
function mostrarDatos() {
$('cardOk').hidden = true;
$('clResumen').innerHTML =
`<span><i class="ri-calendar-event-line" aria-hidden="true"></i>${esc(fechaWeb(sel.fecha))}</span>` +
`<span><i class="ri-time-line" aria-hidden="true"></i>${esc(sel.hora)} – ${horaStr(minutos(sel.hora) + sel.dur)}</span>` +
`<span><i class="ri-money-euro-circle-line" aria-hidden="true"></i>${eur(sel.precio)}</span>`;
mostrarBloques();
const card = $('cardDatos');
card.hidden = false;
card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function mostrarBloques() {
const f = flujo.fase;
$('bloqueTel').hidden = f !== 'tel';
$('bloqueExistente').hidden = f !== 'existente';
$('bloqueNuevo').hidden = f !== 'nuevo';
$('bloqueConfirmar').hidden = !(f === 'nuevo' || f === 'listo');
$('clHola').hidden = f !== 'listo';
if (!$('bloqueConfirmar').hidden) iniciarTurnstile();
if (f === 'listo') $('clHola').innerHTML = `<i class="ri-user-line" aria-hidden="true"></i>Hola, <b>${esc(flujo.nombre)}</b>`;
}
function resetFlujo() {
flujo.fase = 'tel';
flujo.codigo = '';
flujo.nombre = '';
['clCodigoEx', 'clNombre', 'clCodigoNew', 'clCodigoNew2'].forEach(id => { $(id).value = ''; });
$('clConsent').checked = false;
mostrarBloques();
}
$('clTel').addEventListener('input', () => { if (flujo.fase !== 'tel') resetFlujo(); });
async function continuarTelefono() {
if (!telefonoValido($('clTel').value)) return toast('Revisa el teléfono (mínimo 9 cifras)', 'warn');
const tel = normalizarTelefono($('clTel').value);
const btn = $('btnTel');
setBusy(btn, true, SPIN + 'Comprobando...');
try {
const r = await conReintento(() => llamarEdge('estado', { p_telefono: tel }));
if (!r || !r.ok) return toast(textoError(r), 'warn');
flujo.tel = tel;
flujo.fase = r.con_codigo ? 'existente' : 'nuevo';
mostrarBloques();
setTimeout(() => $(r.con_codigo ? 'clCodigoEx' : 'clNombre').focus(), 60);
} catch (err) { errorRed(err); } finally { setBusy(btn, false); }
}
async function entrarExistente() {
const codigo = $('clCodigoEx').value.trim();
if (!codigo) return toast('Escribe tu código', 'warn');
const btn = $('btnEntrar');
setBusy(btn, true, SPIN + 'Entrando...');
try {
const r = await rpc('web_identificar', { p_ident: flujo.tel, p_codigo: codigo });
if (!r || !r.ok) return toast(textoError(r), r && r.error === 'bloqueado' ? 'err' : 'warn');
flujo.codigo = codigo;
flujo.nombre = r.nombre;
flujo.fase = 'listo';
$('clCodigoEx').value = '';
mostrarBloques();
} catch (err) { errorRed(err); } finally { setBusy(btn, false); }
}
async function confirmarReserva() {
if (!sel.hora) return toast('Elige una hora', 'warn');
if (!horaReservable(sel.fecha, sel.hora)) {
toast(textoAntelacion() + ' Llama al club.', 'err');
sel.hora = null; $('cardDatos').hidden = true; dibujarHuecos();
return;
}
let nombre = flujo.nombre, codigo = flujo.codigo;
if (flujo.fase === 'nuevo') {
nombre = $('clNombre').value.trim().replace(/\s+/g, ' ');
const c1 = $('clCodigoNew').value.trim(), c2 = $('clCodigoNew2').value.trim();
if (nombre.split(' ').length < 2) return toast('Escribe tu nombre y apellidos', 'warn');
if (c1.length < 4) return toast('El código debe tener al menos 4 caracteres', 'warn');
if (c1 !== c2) return toast('Los códigos no coinciden', 'warn');
if (!$('clConsent').checked) return toast('Debes aceptar la política de privacidad', 'warn');
codigo = c1;
}
if (TURNSTILE_SITEKEY && !tsToken) return toast('Completa la verificación anti-spam', 'warn');
const btn = $('btnConfirmar');
setBusy(btn, true, SPIN + 'Reservando...');
try {
const r = await llamarEdge('reservar', {
p_telefono: flujo.tel, p_nombre: nombre, p_codigo: codigo,
p_fecha: sel.fecha, p_hora: sel.hora, p_duracion: sel.dur,
turnstile: tsToken, consentimiento: flujo.fase === 'nuevo' && $('clConsent').checked
});
if (!r || !r.ok) {
toast(textoError(r), 'err');
if (r && (r.error === 'sin_disponibilidad' || r.error === 'hora_pasada')) { sel.hora = null; $('cardDatos').hidden = true; cargarHuecos(); }
if (r && (r.error === 'codigo_incorrecto' || r.error === 'bloqueado' || r.error === 'cliente_existente')) resetFlujo();
return;
}
flujo.fase = 'listo';
flujo.nombre = r.reserva.nombre;
flujo.codigo = codigo;
cuenta = { ident: flujo.tel, codigo, nombre: r.reserva.nombre };
mostrarExito(r.reserva);
} catch (err) {
const m = String((err && err.message) || '');
if (/antelacion_insuficiente/i.test(m)) {
toast(textoAntelacion() + ' Llama al club.', 'err');
sel.hora = null; $('cardDatos').hidden = true; cargarHuecos();
} else if (err && err.code === '23P01') {
toast(textoError({ error: 'sin_disponibilidad' }), 'err');
sel.hora = null; $('cardDatos').hidden = true; cargarHuecos();
} else errorRed(err);
} finally { setBusy(btn, false); reiniciarTurnstile(); }
}
let ultimaReserva = null;
function mostrarExito(rv) {
ultimaReserva = rv;
$('cardDatos').hidden = true;
$('okDetalle').innerHTML =
`<div><i class="ri-calendar-event-line" aria-hidden="true"></i>${esc(fechaWeb(rv.fecha))}</div>` +
`<div><i class="ri-time-line" aria-hidden="true"></i>${esc(rv.hora)} – ${horaStr(minutos(rv.hora) + rv.duracion)} (${esc(duracionTxt(rv.duracion))})</div>` +
`<div><i class="ri-map-pin-line" aria-hidden="true"></i>${esc(rv.pista)}</div>` +
`<div><i class="ri-money-euro-circle-line" aria-hidden="true"></i>${eur(rv.precio)} · se paga en el club</div>` +
`<div><i class="ri-hourglass-line" aria-hidden="true"></i>Pendiente de confirmación del club</div>`;
const ok = $('cardOk');
ok.hidden = false;
ok.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
sel.hora = null;
cargarHuecos();
}
$('btnTel').addEventListener('click', continuarTelefono);
$('btnEntrar').addEventListener('click', entrarExistente);
$('btnConfirmar').addEventListener('click', confirmarReserva);
$('cardDatos').addEventListener('keydown', e => {
if (e.key !== 'Enter' || e.target.tagName !== 'INPUT') return;
e.preventDefault();
const b = [$('btnTel'), $('btnEntrar'), $('btnConfirmar')].find(x => x.offsetParent !== null);
if (b) b.click();
});
function icsTexto(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
function icsFecha(iso, min) { const [y, m, d] = iso.split('-'); return `${y}${m}${d}T${String(Math.floor(min / 60)).padStart(2, '0')}${String(min % 60).padStart(2, '0')}00`; }
function descargarICS(rv) {
const ini = minutos(rv.hora), fin = ini + rv.duracion;
const sello = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const lineas = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Geopadel//Reservas//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
`UID:${rv.id || Date.now()}-${rv.fecha}-${rv.hora}@geopadel`, `DTSTAMP:${sello}`,
`DTSTART:${icsFecha(rv.fecha, ini)}`, `DTEND:${icsFecha(rv.fecha, fin)}`,
`SUMMARY:${icsTexto('Pádel en Geopadel · ' + rv.pista)}`, `LOCATION:${icsTexto('Geopadel · ' + rv.pista)}`,
`DESCRIPTION:${icsTexto('Reserva pendiente de confirmación del club. Se paga en el club.')}`,
'BEGIN:VALARM', 'TRIGGER:-PT60M', 'ACTION:DISPLAY', 'DESCRIPTION:Pádel en 1 hora', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'];
descargarBlob(new Blob([lineas.join('\r\n')], { type: 'text/calendar;charset=utf-8' }), 'reserva-geopadel.ics');
}
$('btnICS').addEventListener('click', () => { if (ultimaReserva) descargarICS(ultimaReserva); });
$('btnOtra').addEventListener('click', () => {
$('cardOk').hidden = true;
window.scrollTo({ top: 0, behavior: 'smooth' });
});
$('btnVerMis').addEventListener('click', () => {
cambiarPestana('mis');
});
function mostrarMis(conLista) {
$('cardMisLogin').hidden = conLista;
$('cardMisLista').hidden = !conLista;
}
function dibujarMisReservas(r) {
$('misHola').innerHTML = `Hola, <b>${esc(r.nombre)}</b>`;
const lista = r.reservas || [];
$('misLista').innerHTML = lista.length ? lista.map(x => {
const fin = horaStr(minutos(x.hora) + x.duracion);
const tipo = x.tipo && x.tipo !== 'Normal' ? `<span class="chip">${esc(x.tipo === 'Pena' ? 'Peña' : x.tipo)}</span>` : '';
const estado = x.estado === 'Pendiente'
? '<span class="badge-pendiente"><i class="ri-hourglass-line" aria-hidden="true"></i>Pendiente de confirmar</span>'
: '<span class="badge-confirmada"><i class="ri-check-line" aria-hidden="true"></i>Confirmada</span>';
const accion = x.motivo
? `<p class="cl-hint">${esc(motivoTexto(x.motivo))}</p>`
: `<button type="button" class="btn-add danger" data-cancelar="${esc(x.id)}"><i class="ri-delete-bin-line" aria-hidden="true"></i>Cancelar reserva</button>`;
return `<article class="cl-res"><div class="cl-res-top"><b>${esc(fechaWeb(x.fecha))}</b>${estado}${tipo}</div>` +
`<div class="cl-res-info"><span><i class="ri-time-line" aria-hidden="true"></i>${esc(x.hora)} – ${fin}</span>` +
`<span><i class="ri-map-pin-line" aria-hidden="true"></i>${esc(x.pista)}</span>` +
`<span><i class="ri-money-euro-circle-line" aria-hidden="true"></i>${eur(x.precio)}</span></div>${accion}</article>`;
}).join('') : '<p class="cl-empty">No tienes reservas próximas.</p>';
}
async function cargarMisReservas(ident, codigo) {
const btn = $('btnMis'), msg = $('msgMis');
setBusy(btn, true, SPIN + 'Buscando...');
msg.innerText = '';
try {
const r = await rpc('web_mis_reservas', { p_ident: ident, p_codigo: codigo });
if (!r || !r.ok) {
cuenta = null;
mostrarMis(false);
msg.className = 'msg-inline msg-error';
msg.innerText = textoError(r);
return;
}
cuenta = { ident, codigo, nombre: r.nombre };
$('misCodigo').value = '';
dibujarMisReservas(r);
mostrarMis(true);
} catch (err) { errorRed(err); } finally { setBusy(btn, false); }
}
$('formMis').addEventListener('submit', e => {
e.preventDefault();
let ident = $('misIdent').value.trim();
const codigo = $('misCodigo').value.trim();
if (ident && /^[+\d\s().-]+$/.test(ident)) ident = normalizarTelefono(ident);
if (!ident || !codigo) return toast('Escribe tu teléfono o nombre y tu código', 'warn');
cargarMisReservas(ident, codigo);
});
$('btnSalirMis').addEventListener('click', () => {
cuenta = null;
$('misIdent').value = '';
$('misCodigo').value = '';
$('msgMis').innerText = '';
mostrarMis(false);
});
$('btnBorrarDatos').addEventListener('click', async () => {
if (!cuenta) return;
if (!confirm('Se borrarán tu nombre, teléfono y código, y se cancelarán tus reservas futuras. No se puede deshacer. ¿Continuar?')) return;
const btn = $('btnBorrarDatos');
setBusy(btn, true, 'Borrando...');
try {
const r = await rpc('web_borrar_mis_datos', { p_ident: cuenta.ident, p_codigo: cuenta.codigo });
if (!r || !r.ok) { toast(textoError(r), 'err'); return; }
cuenta = null;
$('misIdent').value = ''; $('misCodigo').value = ''; $('msgMis').innerText = '';
mostrarMis(false);
toast('Tus datos se han borrado');
} catch (err) { errorRed(err); } finally { setBusy(btn, false); }
});
$('misLista').addEventListener('click', async e => {
const b = e.target.closest('button[data-cancelar]');
if (!b || !cuenta) return;
if (!confirm('¿Cancelar esta reserva?')) return;
setBusy(b, true, SPIN + 'Cancelando...');
try {
const r = await rpc('web_cancelar', { p_ident: cuenta.ident, p_codigo: cuenta.codigo, p_reserva_id: b.dataset.cancelar });
if (!r || !r.ok) { toast(textoError(r), 'err'); setBusy(b, false); return; }
toast('Reserva cancelada');
await cargarMisReservas(cuenta.ident, cuenta.codigo);
} catch (err) { errorRed(err); setBusy(b, false); }
});
setInterval(() => { if (!document.hidden && sel.fecha && $('tab-reservar').classList.contains('active')) dibujarHuecos(); }, 60000);
window.addEventListener('online', estadoRed);
window.addEventListener('offline', estadoRed);
document.addEventListener('visibilitychange', () => {
if (!document.hidden && navigator.onLine && sel.fecha && $('tab-reservar').classList.contains('active')) cargarHuecos();
});
window.addEventListener('DOMContentLoaded', async () => {
iniciarTema();
$('btnTema').addEventListener('click', alternarTema);
estadoRed();
if (!sb) {
$('clSlots').innerHTML = '<p class="cl-empty">No se pudo cargar el sistema de reservas. Revisa tu conexión y recarga la página.</p>';
return;
}
try {
const c = await rpc('web_config');
if (c && Array.isArray(c.duraciones)) cfg = { ...cfg, ...c };
} catch (err) { console.error(err); }
if (!cfg.duraciones.includes(sel.dur)) sel.dur = cfg.duraciones[0];
$('txtIntroReserva').textContent = `Elige día, duración y hora. Se paga en el club. Reserva con ${duracionTxt(antMin())} de antelación; con menos, llama al club.`;
dibujarDias();
dibujarDuraciones();
seleccionarDia(fechaLocalISO());
});
let promptInstalacion = null;
const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const yaInstalada = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const mostrarInstalar = on => $('btnInstalar').classList.toggle('visible', on);
window.addEventListener('beforeinstallprompt', e => {
e.preventDefault();
promptInstalacion = e;
mostrarInstalar(true);
});
window.addEventListener('appinstalled', () => { promptInstalacion = null; mostrarInstalar(false); });
$('btnInstalar').addEventListener('click', async () => {
if (!promptInstalacion) { toast('En Safari pulsa Compartir y elige «Añadir a pantalla de inicio»', 'ok', 7000); return; }
promptInstalacion.prompt();
await promptInstalacion.userChoice;
promptInstalacion = null;
mostrarInstalar(false);
});
if (esIOS && !yaInstalada()) mostrarInstalar(true);
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { }));