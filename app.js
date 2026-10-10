/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
const SUPABASE_URL = "https://gprpyxeamjmvmqtkjvtn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwcnB5eGVhbWptdm1xdGtqdnRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1NjE3MzQsImV4cCI6MjEwNzEzNzczNH0.GeGAmqywLM7HsfUIGj9i6f50vhf_ijh9CWc-Y-DdANA";
const DOMINIO_LOGIN = '@geopadel.app';
const supabaseClient = (window.supabase && window.supabase.createClient)
? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
auth: { storage: window.sessionStorage, persistSession: true, autoRefreshToken: true }
})
: null;
const listaPistas = ["1 PADEL MASTER", "Pista 2", "Pista 3", "Pista 4", "Pista 5", "Pista 6", "Pista 7", "Pista 8", "Pista 9"];
const APERT_MIN = 8 * 60;
const bloqueDescansoInicio = 14 * 60;
const bloqueDescansoFin = 17 * 60;
const cierreMin = 24 * 60;
let horaInicioGrid = 8, horaFinGrid = 23.5;
let usuarioSesion = null;
let datosLocales = { productos: [], clientes: [], reservas: [], tarifas: {}, caja: { totalEfectivo: 0, totalTarjeta: 0, totalGeneral: 0 } };
const TARIFAS_DEFECTO = { semanaManana: 20, semanaTarde: 26, finde: 26 };
let reservaEnEdicion = null;
let dragGrabOffsetY = 0;
let suprimirClick = false;
let scrollAhoraPendiente = true;
let canalRealtime = null;
let canalConError = false;
const listaMesas = ["Suelto", "Mesa 1", "Mesa 2", "Mesa 3", "Mesa 4", "Mesa 5", "Mesa 6", "Barra"];
let mesaSeleccionada = "Mesa 1";
let cuentasMesas = {};
listaMesas.forEach(m => cuentasMesas[m] = []);
let categoriaTPVFiltro = "Todos";
let colaMesas = Promise.resolve();
let cobrando = false;
let ultimoFichaje = null;
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const eur = n => (Number(n) || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
const redondear2 = n => Math.round((Number(n) || 0) * 100) / 100;
const nombreUsuario = () => usuarioSesion ? (usuarioSesion.user || usuarioSesion.nombre) : 'Sistema';
function debounce(fn, ms) {
let t;
return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
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
function sumarDiasISO(fechaISO, dias) {
const [y, m, d] = fechaISO.split('-').map(Number);
return new Date(Date.UTC(y, m - 1, d + dias, 12, 0, 0)).toISOString().split('T')[0];
}
function rangoDiaISO(iso) {
const [y, m, d] = iso.split('-').map(Number);
return [new Date(y, m - 1, d, 0, 0, 0).toISOString(), new Date(y, m - 1, d + 1, 0, 0, 0).toISOString()];
}
function fechaBonita(iso) {
const [y, m, d] = iso.split('-').map(Number);
return new Date(y, m - 1, d).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}
function timeToMin(tStr) {
const parts = String(tStr || '0:0').split(':');
return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
}
function minToTimeStr(min) {
const h = Math.floor(min / 60), m = min % 60;
return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
function esCerrado(min) {
return min < (9 * 60) || (min >= bloqueDescansoInicio && min < bloqueDescansoFin) || min >= (23 * 60 + 30);
}
function esFranjaBloqueada(iniMin, finMin, tipoReserva = "Normal") {
if (tipoReserva === "Torneo") return iniMin < (8 * 60) || finMin > (24 * 60);
if (iniMin < (9 * 60) || finMin > (23 * 60 + 30)) return true;
if (iniMin < bloqueDescansoFin && finMin > bloqueDescansoInicio) return true;
return false;
}
function pxPorMin() {
const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--slot-h'));
return (v || 30) / 30;
}
const FILTRO_NO_CANCELADA = 'estado.is.null,estado.neq.Cancelada';
function aplicarTema(t, guardar = true) {
document.documentElement.setAttribute('data-theme', t);
if (guardar) { try { localStorage.setItem('gp-theme', t); } catch (e) { } }
$('metaTheme').setAttribute('content', t === 'dark' ? '#364650' : '#fcfdfc');
document.querySelectorAll('.theme-toggle').forEach(b => {
b.innerHTML = t === 'dark' ? '<i class="ri-sun-line" aria-hidden="true"></i>' : '<i class="ri-moon-line" aria-hidden="true"></i>';
b.setAttribute('aria-label', t === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
b.title = t === 'dark' ? 'Modo claro' : 'Modo oscuro';
});
}
function alternarTema() {
aplicarTema(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
}
function iniciarTema() {
aplicarTema(document.documentElement.getAttribute('data-theme') || 'light', false);
try {
const mq = window.matchMedia('(prefers-color-scheme: dark)');
const seguir = e => { let g = null; try { g = localStorage.getItem('gp-theme'); } catch (x) { } if (!g) aplicarTema(e.matches ? 'dark' : 'light', false); };
if (mq.addEventListener) mq.addEventListener('change', seguir);
} catch (e) { }
}
let intentosFallidos = 0, bloqueoHasta = 0;
async function cargarPerfil(authUser) {
const { data, error } = await supabaseClient.from('usuarios')
.select('id, usuario, nombre, rol')
.eq('auth_id', authUser.id).eq('estado', 'Activo').maybeSingle();
if (error || !data) return null;
return { id: data.id, user: data.usuario, nombre: data.nombre, rol: data.rol };
}
async function comprobarSesion() {
if (!supabaseClient) { mostrarLogin(); return; }
const { data } = await supabaseClient.auth.getSession();
if (data && data.session) {
const perfil = await cargarPerfil(data.session.user);
if (perfil) { usuarioSesion = perfil; mostrarPanelAdmin(); return; }
await supabaseClient.auth.signOut();
}
mostrarLogin();
}
async function cerrarSesion() {
if (canalRealtime) { supabaseClient.removeChannel(canalRealtime); canalRealtime = null; }
await supabaseClient.auth.signOut();
usuarioSesion = null;
$('password').value = '';
$('msgLogin').innerText = '';
cambiarPestana('reservas');
mostrarLogin();
}
if (supabaseClient) {
supabaseClient.auth.onAuthStateChange((evento) => {
if (evento === 'SIGNED_OUT' && usuarioSesion) { usuarioSesion = null; mostrarLogin(); }
});
}
function mostrarLogin() {
$('loginView').style.display = 'flex';
$('adminView').style.display = 'none';
}
function mostrarPanelAdmin() {
if (!supabaseClient) { mostrarLogin(); $('msgLogin').className = 'msg-error'; $('msgLogin').innerText = 'No se pudo cargar la librería de base de datos. Revisa tu conexión y recarga.'; return; }
$('loginView').style.display = 'none';
$('adminView').style.display = 'block';
$('nombreEmpleado').innerText = usuarioSesion.nombre;
$('rolEmpleado').innerText = usuarioSesion.rol || 'Trabajador';
inicializarFechaHoy();
pobladorPistasModal();
renderSelectorMesas();
iniciarSuscripcionRealtime();
cargarDatosGlobales();
cargarMisFichajes();
}
$('loginForm').addEventListener('submit', async function (e) {
e.preventDefault();
const msgDiv = $('msgLogin'), btn = $('btnEntrar');
if (!supabaseClient) { msgDiv.className = 'msg-error'; msgDiv.innerText = 'No se pudo cargar la base de datos. Recarga la página.'; return; }
if (Date.now() < bloqueoHasta) {
msgDiv.className = 'msg-error';
msgDiv.innerText = `Demasiados intentos. Espera ${Math.ceil((bloqueoHasta - Date.now()) / 1000)} s.`;
return;
}
const user = $('usuario').value.trim().toLowerCase().replace(/\s+/g, '');
const pass = $('password').value;
if (!user || !pass) { msgDiv.className = 'msg-error'; msgDiv.innerText = 'Introduce usuario y contraseña'; return; }
btn.disabled = true; btn.innerText = "Verificando...";
msgDiv.className = ''; msgDiv.innerText = 'Conectando...';
try {
const { data, error } = await supabaseClient.auth.signInWithPassword({ email: user + DOMINIO_LOGIN, password: pass });
if (error) {
if (error.status === 400 || /invalid login/i.test(error.message || '')) {
intentosFallidos++;
if (intentosFallidos >= 5) { bloqueoHasta = Date.now() + 30000; intentosFallidos = 0; }
msgDiv.className = 'msg-error'; msgDiv.innerText = 'Credenciales incorrectas';
} else throw error;
} else {
const perfil = await cargarPerfil(data.user);
if (!perfil) {
await supabaseClient.auth.signOut();
msgDiv.className = 'msg-error'; msgDiv.innerText = 'Usuario inactivo o sin perfil. Contacta con el administrador.';
} else {
intentosFallidos = 0;
usuarioSesion = perfil;
msgDiv.className = 'msg-success'; msgDiv.innerText = '¡Bienvenido!';
setTimeout(() => { btn.disabled = false; btn.innerText = "Entrar al Panel"; mostrarPanelAdmin(); }, 250);
return;
}
}
} catch (err) {
console.error(err);
msgDiv.className = 'msg-error'; msgDiv.innerText = 'Error de conexión. Inténtalo de nuevo.';
}
btn.disabled = false; btn.innerText = "Entrar al Panel";
});
const refrescar = {
reservas: debounce(() => cargarReservasHoy(), 250),
mesas: debounce(() => cargarMesasBar(), 250),
ventas: debounce(() => cargarCajaHoy(), 400),
productos: debounce(() => cargarProductos(), 300),
tarifas: debounce(() => cargarTarifas(), 300)
};
function iniciarSuscripcionRealtime() {
if (canalRealtime) { supabaseClient.removeChannel(canalRealtime); canalRealtime = null; }
canalRealtime = supabaseClient.channel('geopadel-realtime')
.on('postgres_changes', { event: '*', schema: 'public', table: 'reservas' }, refrescar.reservas)
.on('postgres_changes', { event: '*', schema: 'public', table: 'mesas_bar' }, refrescar.mesas)
.on('postgres_changes', { event: '*', schema: 'public', table: 'ventas' }, refrescar.ventas)
.on('postgres_changes', { event: '*', schema: 'public', table: 'productos' }, refrescar.productos)
.on('postgres_changes', { event: '*', schema: 'public', table: 'tarifas' }, refrescar.tarifas)
.subscribe((status) => {
if (status === 'SUBSCRIBED') {
mostrarFlashSync();
if (canalConError) { canalConError = false; cargarDatosGlobales(); }
} else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
canalConError = true;
}
});
}
function mostrarFlashSync() {
const el = $('gpSync');
el.style.opacity = 1;
setTimeout(() => { el.style.opacity = 0; }, 1500);
}
function estadoRed() { $('bannerOffline').classList.toggle('show', !navigator.onLine); }
window.addEventListener('online', () => { estadoRed(); if (usuarioSesion) cargarDatosGlobales(); });
window.addEventListener('offline', estadoRed);
document.addEventListener('visibilitychange', () => { if (!document.hidden && usuarioSesion && navigator.onLine) cargarDatosGlobales(); });
async function cargarDatosGlobales() {
await Promise.all([cargarClientes(), cargarProductos(), cargarTarifas(), cargarMesasBar(), cargarReservasHoy(), cargarCajaHoy()]);
}
async function cargarClientes() {
const { data, error } = await supabaseClient.from('clientes').select('*').limit(5000);
if (error) { console.error(error); return; }
datosLocales.clientes = data || [];
dibujarClientesDatalist(datosLocales.clientes);
}
async function cargarProductos() {
const { data, error } = await supabaseClient.from('productos').select('*').neq('estado', 'Eliminado').order('nombre');
if (error) { console.error(error); toast('No se pudo cargar el catálogo', 'err'); return; }
datosLocales.productos = data || [];
dibujarCatalogo(datosLocales.productos);
}
async function cargarTarifas() {
const { data, error } = await supabaseClient.from('tarifas').select('*');
if (error) { console.error(error); return; }
const tf = {};
(data || []).forEach(t => {
if (t.franja === 'Entre semana mañana') tf.semanaManana = Number(t.precio_90min);
if (t.franja === 'Entre semana tarde') tf.semanaTarde = Number(t.precio_90min);
if (t.franja === 'Fin de semana') tf.finde = Number(t.precio_90min);
});
datosLocales.tarifas = tf;
dibujarTarifas({ ...TARIFAS_DEFECTO, ...tf });
}
async function cargarMesasBar() {
const { data, error } = await supabaseClient.from('mesas_bar').select('*');
if (error) { console.error(error); return; }
(data || []).forEach(row => { cuentasMesas[row.mesa] = Array.isArray(row.items) ? row.items : []; });
renderSelectorMesas();
}
let reqReservas = 0;
async function cargarReservasHoy() {
const iso = $('fechaCuadrante').value || fechaLocalISO();
const miReq = ++reqReservas;
const { data, error } = await supabaseClient.from('reservas').select('*').eq('fecha', iso).or(FILTRO_NO_CANCELADA);
if (miReq !== reqReservas) return;
if (error) { console.error(error); toast('No se pudieron cargar las reservas', 'err'); return; }
datosLocales.reservas = (data || []).map(r => ({
id: r.id,
cliente: r.cliente || '',
telefono: r.telefono,
fecha: r.fecha,
horaInicio: String(r.hora_inicio || '00:00').slice(0, 5),
duracionMin: r.duracion_min,
pista: r.pista,
estado: r.estado,
pagoEstado: r.pago_estado,
tipoReserva: r.tipo_reserva,
numJugadores: r.jugadores,
pagosJugadores: r.pagos_jugadores,
precio: r.precio,
empleado: r.empleado,
serie: r.serie,
notas: r.notas || ''
}));
renderizarCuadrantePlaytomic(datosLocales.reservas);
}
let reqCaja = 0;
async function cargarCajaHoy() {
const iso = $('fechaCuadrante').value || fechaLocalISO();
const miReq = ++reqCaja;
const [ini, fin] = rangoDiaISO(iso);
const { data, error } = await supabaseClient.from('ventas').select('importe, metodo_pago').gte('fecha_hora', ini).lt('fecha_hora', fin).limit(10000);
if (miReq !== reqCaja) return;
if (error) { console.error(error); toast('No se pudo cargar la caja', 'err'); return; }
let ef = 0, ta = 0;
(data || []).forEach(v => {
if (v.metodo_pago === 'Efectivo') ef += Number(v.importe) || 0;
if (v.metodo_pago === 'Tarjeta') ta += Number(v.importe) || 0;
});
ef = redondear2(ef); ta = redondear2(ta);
datosLocales.caja = { totalEfectivo: ef, totalTarjeta: ta, totalGeneral: redondear2(ef + ta) };
dibujarCaja(datosLocales.caja);
calcCierre();
}
function cambiarPestana(tabName) {
document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
document.querySelectorAll('.nav-tab').forEach(el => { el.classList.remove('active'); el.removeAttribute('aria-current'); });
$(`tab-${tabName}`).classList.add('active');
const nav = $(`nav-${tabName}`); nav.classList.add('active'); nav.setAttribute('aria-current', 'page');
document.title = 'Geopadel · ' + ({ reservas: 'Reservas', tpv: 'TPV Bar', fichajes: 'Control Horario', caja: 'Caja y Catálogo' }[tabName] || 'Panel');
if (usuarioSesion) {
if (tabName === 'caja') { cargarHistorialCaja(); cargarCajaHoy(); }
if (tabName === 'fichajes') cargarMisFichajes();
if (tabName === 'tpv') cargarMesasBar();
if (tabName === 'reservas') { scrollAhoraPendiente = true; renderizarCuadrantePlaytomic(datosLocales.reservas || []); }
}
}
document.querySelectorAll('.nav-tab').forEach(b => b.addEventListener('click', () => cambiarPestana(b.dataset.tab)));
function inicializarFechaHoy() { $('fechaCuadrante').value = fechaLocalISO(); }
function alCambiarFecha() { scrollAhoraPendiente = true; cargarReservasHoy(); cargarCajaHoy(); }
function irAFechaHoy() { inicializarFechaHoy(); alCambiarFecha(); }
function cambiarFechaDias(offset) {
const inputF = $('fechaCuadrante');
inputF.value = sumarDiasISO(inputF.value || fechaLocalISO(), offset);
alCambiarFecha();
}
function pobladorPistasModal(pistasSeleccionadas = []) {
const container = $('modalPistasContainer');
container.innerHTML = "";
listaPistas.forEach(p => {
const label = document.createElement('label');
label.className = 'pistas-checkbox-item';
const isChecked = pistasSeleccionadas.length === 0 ? (p === "1 PADEL MASTER") : pistasSeleccionadas.includes(p);
label.innerHTML = `<input type="checkbox" name="chkPistasModal" value="${esc(p)}" ${isChecked ? 'checked' : ''}><span>${esc(p)}</span>`;
container.appendChild(label);
});
}
function obtenerPistasSeleccionadasModal() {
return Array.from(document.querySelectorAll('input[name="chkPistasModal"]:checked')).map(c => c.value);
}
function dibujarClientesDatalist(clientes) {
const dlNom = $('dlClientesNombres'), dlTel = $('dlClientesTelefonos');
dlNom.innerHTML = ""; dlTel.innerHTML = "";
(clientes || []).forEach(c => {
if (c.nombre) dlNom.appendChild(new Option(c.telefono ? `Tel: ${c.telefono}` : '', c.nombre));
if (c.telefono) dlTel.appendChild(new Option(c.nombre || '', c.telefono));
});
}
function autocompletarClientePorNombre() {
const v = $('modalCliente').value.trim().toLowerCase();
const match = (datosLocales.clientes || []).find(c => String(c.nombre).trim().toLowerCase() === v);
if (match && match.telefono) $('modalTelefono').value = match.telefono;
}
function autocompletarClientePorTelefono() {
const v = $('modalTelefono').value.trim();
const match = (datosLocales.clientes || []).find(c => String(c.telefono).trim() === v);
if (match && match.nombre) $('modalCliente').value = match.nombre;
}
function renderizarCuadrantePlaytomic(reservas) {
const grid = $('playtomicGrid');
if (!grid) return;
const wrapper = $('gridWrapper');
const prevScrollTop = wrapper.scrollTop, prevScrollLeft = wrapper.scrollLeft;
const ppm = pxPorMin();
let rIni = APERT_MIN, rFin = cierreMin;
reservas.forEach(r => {
const a = timeToMin(r.horaInicio), b = a + (parseInt(r.duracionMin, 10) || 90);
if (a < rIni) rIni = a;
if (b > rFin) rFin = b;
});
horaInicioGrid = Math.floor(rIni / 60);
horaFinGrid = (Math.ceil(rFin / 30) * 30 - 30) / 60;
const frag = document.createDocumentFragment();
const corner = document.createElement('div');
corner.className = 'grid-header-corner';
corner.innerHTML = '<img class="gp-logo-corner" src="./Geopadel.png" alt="" draggable="false">';
frag.appendChild(corner);
listaPistas.forEach(pista => {
const hp = document.createElement('div');
hp.className = 'grid-header-pista';
hp.textContent = pista;
hp.title = pista;
frag.appendChild(hp);
});
const colTime = document.createElement('div');
colTime.className = 'col-time-axis';
for (let min = horaInicioGrid * 60; min <= horaFinGrid * 60; min += 30) {
const el = document.createElement('div');
const bloqueado = esCerrado(min);
el.className = 'time-slot-label' + (bloqueado ? ' blocked' : (min % 60 === 0 ? ' hour' : ''));
el.textContent = minToTimeStr(min);
colTime.appendChild(el);
}
const esHoy = ($('fechaCuadrante').value === fechaLocalISO());
let topPxAhora = -1;
if (esHoy) {
const ah = new Date();
const minAhora = ah.getHours() * 60 + ah.getMinutes();
const minGridIni = horaInicioGrid * 60, minGridFin = horaFinGrid * 60 + 30;
if (minAhora >= minGridIni && minAhora <= minGridFin) {
topPxAhora = (minAhora - minGridIni) * ppm;
const badge = document.createElement('div');
badge.className = 'time-badge-now';
badge.style.top = `${topPxAhora - 8}px`;
badge.textContent = minToTimeStr(minAhora);
colTime.appendChild(badge);
}
}
frag.appendChild(colTime);
let totalReservasPista = 0;
listaPistas.forEach(pista => {
const colPista = document.createElement('div');
colPista.className = 'court-column';
colPista.dataset.pista = pista;
for (let min = horaInicioGrid * 60; min <= horaFinGrid * 60; min += 30) {
const slot = document.createElement('div');
const bloqueado = esCerrado(min);
slot.className = 'slot ' + (bloqueado ? 'blocked' : (min % 60 === 0 ? 'hour' : 'half'));
slot.dataset.min = min;
slot.dataset.pista = pista;
colPista.appendChild(slot);
}
if (topPxAhora >= 0) {
const line = document.createElement('div');
line.className = 'court-line-now';
line.style.top = `${topPxAhora}px`;
colPista.appendChild(line);
}
reservas.filter(r => r.pista === pista).forEach(r => {
totalReservasPista++;
const card = document.createElement('div');
const iniMin = timeToMin(r.horaInicio);
const dur = parseInt(r.duracionMin, 10) || 90;
const topPx = (iniMin - horaInicioGrid * 60) * ppm;
const heightPx = dur * ppm - 2;
const nJug = parseInt(r.numJugadores, 10) || 4;
const arrPagos = String(r.pagosJugadores || "").split(",");
while (arrPagos.length < nJug) arrPagos.push("0");
const esPagadoIdx = i => { const p = arrPagos[i]; return p === 'Efectivo' || p === 'Tarjeta' || (p && p !== '0'); };
let pagados = 0;
for (let i = 0; i < nJug; i++) if (esPagadoIdx(i)) pagados++;
const totalPagado = pagados >= nJug;
let estiloTipo = 'card-normal-striped';
if (r.tipoReserva === 'Pena') estiloTipo = 'card-pena-striped';
if (r.tipoReserva === 'Torneo') estiloTipo = 'card-torneo-striped';
if (r.tipoReserva === 'Entrenamiento') estiloTipo = 'card-entreno-striped';
if (totalPagado) estiloTipo = 'card-normal-solid';
const tieneNota = !!String(r.notas || '').trim();
card.className = `reserva-card ${estiloTipo}${heightPx < 100 ? ' compact' : ''}${tieneNota ? ' has-nota' : ''}`;
card.style.top = `${topPx}px`;
card.style.height = `${heightPx}px`;
card.draggable = r.tipoReserva !== 'Torneo';
card.dataset.id = r.id;
card.dataset.tipo = r.tipoReserva || 'Normal';
const badge = totalPagado ? `<div class="badge-pagado"><i class="ri-check-line" aria-hidden="true"></i>Pagado</div>`
: (pagados > 0 ? `<div class="badge-parcial">Parcial ${pagados}/${nJug}</div>` : `<div class="badge-sin-pagar">Sin pagar</div>`);
let dots = '<div class="pagos-dots-container">';
for (let i = 0; i < nJug; i++) {
const ok = esPagadoIdx(i);
dots += `<span class="pago-dot ${ok ? 'pagado' : 'pendiente'}">${ok ? '<i class="ri-check-line" aria-hidden="true"></i>' : '<i class="ri-close-line" aria-hidden="true"></i>'}</span>`;
}
dots += '</div>';
card.innerHTML = `
<div class="reserva-top">${badge}${dots}</div>
<div class="reserva-title">${r.serie ? '<i class="ri-repeat-line" aria-hidden="true"></i>' : ''}${esc(r.cliente)}</div>
${tieneNota && heightPx >= 150 ? `<div class="reserva-nota-txt">${esc(r.notas)}</div>` : ''}
<div class="reserva-time"><span>${esc(r.horaInicio)} - ${minToTimeStr(iniMin + dur)}</span>${tieneNota ? '<span class="nota-flag"><i class="ri-sticky-note-fill" aria-hidden="true"></i>Nota</span>' : ''}</div>`;
card.title = `${r.cliente} · ${r.horaInicio}-${minToTimeStr(iniMin + dur)}${tieneNota ? '\nNota: ' + r.notas : ''}`;
colPista.appendChild(card);
});
frag.appendChild(colPista);
});
grid.innerHTML = "";
grid.appendChild(frag);
const ventanas = [[9 * 60, 14 * 60], [17 * 60, 23.5 * 60]];
const minDisp = listaPistas.length * ventanas.reduce((s, [a, b]) => s + (b - a), 0);
let minOcup = 0;
reservas.forEach(r => {
const a = timeToMin(r.horaInicio), b = a + (parseInt(r.duracionMin, 10) || 90);
ventanas.forEach(([v1, v2]) => { minOcup += Math.max(0, Math.min(b, v2) - Math.max(a, v1)); });
});
$('statOcupacion').innerText = `${Math.min(100, Math.round(minOcup / minDisp * 100)) || 0}%`;
$('statNumReservas').innerText = totalReservasPista;
if (scrollAhoraPendiente && wrapper.clientHeight > 0) {
scrollAhoraPendiente = false;
if (topPxAhora >= 0) wrapper.scrollTop = Math.max(0, topPxAhora - 90);
else wrapper.scrollTop = Math.max(0, (9 * 60 - horaInicioGrid * 60) * ppm);
wrapper.scrollLeft = 0;
} else {
wrapper.scrollTop = prevScrollTop; wrapper.scrollLeft = prevScrollLeft;
}
}
setInterval(() => {
if (!document.hidden && usuarioSesion && $('fechaCuadrante').value === fechaLocalISO() && $('tab-reservas').classList.contains('active')) {
renderizarCuadrantePlaytomic(datosLocales.reservas || []);
}
}, 30000);
window.addEventListener('resize', debounce(() => { if (usuarioSesion) renderizarCuadrantePlaytomic(datosLocales.reservas || []); }, 200));
(function iniciarInteraccionGrid() {
const grid = $('playtomicGrid');
grid.addEventListener('click', e => {
if (suprimirClick) return;
const card = e.target.closest('.reserva-card');
if (card) {
const r = (datosLocales.reservas || []).find(x => String(x.id) === card.dataset.id);
if (r) abrirModalEditarReserva(r);
return;
}
const slot = e.target.closest('.slot');
if (slot) {
const min = parseInt(slot.dataset.min, 10);
abrirModalNuevaReserva([slot.dataset.pista], minToTimeStr(min), esCerrado(min) ? 'Torneo' : 'Normal');
}
});
grid.addEventListener('contextmenu', e => { if (e.target.closest('.reserva-card')) e.preventDefault(); });
grid.addEventListener('dragstart', e => {
const card = e.target.closest('.reserva-card');
if (!card) return;
dragGrabOffsetY = e.clientY - card.getBoundingClientRect().top;
e.dataTransfer.setData('text/plain', card.dataset.id);
e.dataTransfer.effectAllowed = 'move';
});
grid.addEventListener('dragover', e => { if (e.target.closest('.court-column')) e.preventDefault(); });
grid.addEventListener('drop', e => {
const col = e.target.closest('.court-column');
if (!col) return;
e.preventDefault();
const id = e.dataTransfer.getData('text/plain');
const topEnCol = e.clientY - col.getBoundingClientRect().top - dragGrabOffsetY;
moverReservaAccion(id, minToTimeStr(horaDesdeTop(topEnCol)), col.dataset.pista);
});
let tdrag = null;
grid.addEventListener('touchstart', e => {
const card = e.target.closest('.reserva-card');
if (!card || card.dataset.tipo === 'Torneo' || e.touches.length !== 1) return;
const t = e.touches[0];
tdrag = { card, id: card.dataset.id, x0: t.clientX, y0: t.clientY, activo: false, rect: null };
tdrag.timer = setTimeout(() => {
if (!tdrag) return;
tdrag.activo = true;
tdrag.rect = card.getBoundingClientRect();
card.classList.add('dragging-touch');
if (navigator.vibrate) navigator.vibrate(12);
}, 380);
}, { passive: true });
grid.addEventListener('touchmove', e => {
if (!tdrag) return;
const t = e.touches[0];
if (!tdrag.activo) {
if (Math.hypot(t.clientX - tdrag.x0, t.clientY - tdrag.y0) > 8) { clearTimeout(tdrag.timer); tdrag = null; }
return;
}
e.preventDefault();
tdrag.card.style.transform = `translate(${t.clientX - tdrag.x0}px, ${t.clientY - tdrag.y0}px) scale(1.03)`;
}, { passive: false });
function finTouch(e) {
if (!tdrag) return;
clearTimeout(tdrag.timer);
const d = tdrag; tdrag = null;
if (!d.activo) return;
d.card.classList.remove('dragging-touch');
d.card.style.transform = '';
suprimirClick = true; setTimeout(() => { suprimirClick = false; }, 400);
if (e.type === 'touchcancel') return;
const t = e.changedTouches[0];
const col = Array.from(grid.querySelectorAll('.court-column')).find(c => {
const r = c.getBoundingClientRect();
return t.clientX >= r.left && t.clientX <= r.right;
});
if (!col) return;
const nuevoTop = d.rect.top + (t.clientY - d.y0) - col.getBoundingClientRect().top;
moverReservaAccion(d.id, minToTimeStr(horaDesdeTop(nuevoTop)), col.dataset.pista);
}
grid.addEventListener('touchend', finTouch);
grid.addEventListener('touchcancel', finTouch);
})();
function horaDesdeTop(topPx) {
const ppm = pxPorMin();
let m = horaInicioGrid * 60 + Math.round(topPx / ppm / 30) * 30;
return Math.max(horaInicioGrid * 60, Math.min(horaFinGrid * 60, m));
}
async function buscarConflicto({ pistas, fechas, iniMin, dur, excluirId }) {
const orden = [...fechas].sort();
const { data, error } = await supabaseClient.from('reservas')
.select('id, pista, fecha, hora_inicio, duracion_min, cliente')
.in('pista', pistas)
.gte('fecha', orden[0]).lte('fecha', orden[orden.length - 1])
.or(FILTRO_NO_CANCELADA);
if (error) throw error;
const set = new Set(fechas), fin = iniMin + dur;
return (data || []).find(r => {
if (excluirId && String(r.id) === String(excluirId)) return false;
if (!set.has(r.fecha)) return false;
const a = timeToMin(r.hora_inicio), b = a + (parseInt(r.duracion_min, 10) || 90);
return iniMin < b && fin > a;
}) || null;
}
async function moverReservaAccion(idRes, nuevaHora, nuevaPista) {
const t = (datosLocales.reservas || []).find(r => String(r.id) === String(idRes));
if (!t) return;
if (nuevaHora === t.horaInicio && nuevaPista === t.pista) return;
const dur = parseInt(t.duracionMin, 10) || 90;
const ini = timeToMin(nuevaHora);
if (esFranjaBloqueada(ini, ini + dur, t.tipoReserva)) return toast("Horario no permitido para este tipo de reserva", 'err');
try {
const c = await buscarConflicto({ pistas: [nuevaPista], fechas: [t.fecha], iniMin: ini, dur, excluirId: t.id });
if (c) return toast(`No se puede mover: ${nuevaPista} está ocupada a las ${String(c.hora_inicio).slice(0, 5)} (${c.cliente})`, 'err');
const { error } = await supabaseClient.from('reservas').update({ hora_inicio: nuevaHora, pista: nuevaPista, updated_at: new Date().toISOString() }).eq('id', t.id);
if (error) throw error;
toast(`Reserva movida a ${nuevaPista} · ${nuevaHora}`);
cargarReservasHoy();
} catch (err) {
console.error(err);
toast("Error al mover la reserva: " + (err.message || err), 'err');
}
}
function esFinde(iso) { const [y, m, d] = iso.split('-').map(Number); const w = new Date(y, m - 1, d, 12).getDay(); return w === 0 || w === 6; }
function precioSugerido() {
const t = { ...TARIFAS_DEFECTO, ...(datosLocales.tarifas || {}) };
const iso = $('modalFecha').value || $('fechaCuadrante').value || fechaLocalISO();
const hora = $('modalHora').value || '17:00';
const base = esFinde(iso) ? t.finde : (timeToMin(hora) < bloqueDescansoInicio ? t.semanaManana : t.semanaTarde);
const tor = $('modalTipoReserva').value === 'Torneo';
const dur = tor ? (parseFloat($('modalDuracionHoras').value) || 0) * 60 : (parseInt($('modalDuracion').value, 10) || 90);
return (dur / 90) * base;
}
function recalcularPrecioSugerido(forzar = true) {
if (!forzar && $('modalReservaId').value) return;
$('modalPrecio').value = precioSugerido().toFixed(2);
actualizarVistasJugadoresSplit();
}
function alCambiarTipo() {
const t = $('modalTipoReserva').value, nueva = !$('modalReservaId').value, tor = t === 'Torneo';
$('boxTorneoDur').style.display = tor ? 'block' : 'none';
$('lblDur').style.display = $('modalDuracion').style.display = tor ? 'none' : 'block';
$('boxRepetir').style.display = (t === 'Pena' && nueva) ? 'block' : 'none';
recalcularPrecioSugerido(nueva);
}
(function () {
const sel = $('modalNumJugadores');
for (let i = 1; i <= 16; i++) sel.appendChild(new Option(i === 1 ? '1 jugador' : `${i} jugadores`, i));
sel.value = '4';
})();
function abrirOverlay(id) {
$(id).classList.add('open');
document.body.style.overflow = 'hidden';
}
function cerrarOverlay(id) {
$(id).classList.remove('open');
if (!document.querySelector('.modal-overlay.open')) document.body.style.overflow = '';
}
function abrirModalNuevaReserva(pistas = ["1 PADEL MASTER"], hora = "17:00", tipo = "Normal") {
if (!Array.isArray(pistas)) pistas = ["1 PADEL MASTER"];
if (typeof hora !== 'string') hora = "17:00";
if (typeof tipo !== 'string') tipo = "Normal";
reservaEnEdicion = { id: "", numJugadores: 4, pagosJugadores: "0,0,0,0", numJugadoresOrig: 4, notas: "" };
$('modalTitulo').innerText = "Nueva reserva";
$('modalReservaId').value = "";
$('modalCliente').value = "";
$('modalTelefono').value = "";
$('modalNotas').value = "";
pobladorPistasModal(pistas);
$('modalHora').value = hora;
$('modalDuracion').value = "90";
$('modalDuracionHoras').value = "8";
$('modalTipoReserva').value = tipo;
$('modalFecha').value = $('fechaCuadrante').value || fechaLocalISO();
$('modalRepetir').value = 12;
$('btnEliminarSerie').style.display = 'none';
$('btnEliminarReserva').style.display = "none";
$('modalNumJugadores').value = "4";
alCambiarTipo();
$('modalPrecio').value = precioSugerido().toFixed(2);
actualizarVistasJugadoresSplit();
abrirOverlay('modalReserva');
setTimeout(() => $('modalCliente').focus(), 60);
}
function abrirModalEditarReserva(res) {
reservaEnEdicion = { ...res };
const nJug = parseInt(res.numJugadores, 10) || 4;
reservaEnEdicion.numJugadoresOrig = nJug;
if (!reservaEnEdicion.pagosJugadores) reservaEnEdicion.pagosJugadores = Array(nJug).fill("0").join(",");
$('modalTitulo').innerText = `${res.pista} · ${res.horaInicio}`;
$('modalReservaId').value = res.id;
$('modalCliente').value = res.cliente;
$('modalTelefono').value = res.telefono || '';
$('modalNotas').value = res.notas || '';
pobladorPistasModal([res.pista]);
$('modalHora').value = res.horaInicio;
const durStr = String(res.duracionMin);
if (!Array.from($('modalDuracion').options).some(o => o.value === durStr)) $('modalDuracion').appendChild(new Option(`${durStr} minutos`, durStr));
$('modalDuracion').value = durStr;
$('modalDuracionHoras').value = res.duracionMin / 60;
$('modalTipoReserva').value = res.tipoReserva || "Normal";
$('modalFecha').value = res.fecha;
$('btnEliminarSerie').style.display = res.serie ? 'inline-block' : 'none';
$('btnEliminarReserva').style.display = "inline-block";
alCambiarTipo();
$('modalNumJugadores').value = String(nJug);
$('modalPrecio').value = parseFloat(res.precio || 0).toFixed(2);
actualizarVistasJugadoresSplit();
abrirOverlay('modalReserva');
}
function actualizarVistasJugadoresSplit() {
if (!reservaEnEdicion) return;
const nJug = parseInt($('modalNumJugadores').value, 10) || 4;
reservaEnEdicion.numJugadores = nJug;
const precioTotal = parseFloat($('modalPrecio').value) || 0;
const precioUnitario = nJug ? precioTotal / nJug : 0;
$('badgePrecioUnitario').innerText = `${eur(precioUnitario)} / pers`;
const arrPagos = String(reservaEnEdicion.pagosJugadores || "").split(",");
while (arrPagos.length < nJug) arrPagos.push("0");
reservaEnEdicion.pagosJugadores = arrPagos.slice(0, nJug).join(",");
const container = $('splitJugadoresContainer');
container.innerHTML = "";
let pagados = 0;
const sinId = !reservaEnEdicion.id;
for (let j = 1; j <= nJug; j++) {
const metodo = arrPagos[j - 1] || "0";
const pagado = (metodo === "Efectivo" || metodo === "Tarjeta");
if (pagado) pagados++;
const cardJ = document.createElement('div');
cardJ.className = `card-jugador-item ${metodo === 'Efectivo' ? 'estado-efectivo' : (metodo === 'Tarjeta' ? 'estado-tarjeta' : '')}`;
const dis = sinId ? 'disabled' : '';
cardJ.innerHTML = `
<div>
<div class="jugador-info-title">Jugador ${j}</div>
<div class="jugador-info-sub">${pagado ? `<i class="ri-check-line" aria-hidden="true"></i>Pagado (${metodo})` : '<i class="ri-time-line" aria-hidden="true"></i>Pendiente'} · ${eur(precioUnitario)}</div>
</div>
<div class="jugador-actions">
<button type="button" ${dis} data-j="${j}" data-m="Efectivo" class="btn-pay-toggle btn-pay-efectivo" aria-label="Pagar en efectivo"><i class="ri-money-euro-circle-line" aria-hidden="true"></i></button>
<button type="button" ${dis} data-j="${j}" data-m="Tarjeta" class="btn-pay-toggle btn-pay-tarjeta" aria-label="Pagar con tarjeta"><i class="ri-bank-card-line" aria-hidden="true"></i></button>
${pagado ? `<button type="button" ${dis} data-j="${j}" data-m="0" class="btn-pay-toggle btn-pay-reset" aria-label="Quitar pago"><i class="ri-close-line" aria-hidden="true"></i></button>` : ''}
</div>`;
container.appendChild(cardJ);
}
if (sinId) {
const nota = document.createElement('div');
nota.style.cssText = 'font-size:12px;color:var(--muted);font-weight:700;text-align:center;padding:6px';
nota.textContent = 'Guarda la reserva para poder registrar los cobros.';
container.appendChild(nota);
}
const badge = $('badgeEstadoPagoGlobal');
if (pagados >= nJug) { badge.className = "badge-pagado"; badge.innerHTML = '<i class="ri-checkbox-circle-line" aria-hidden="true"></i>Totalmente pagado'; }
else if (pagados > 0) { badge.className = "badge-parcial"; badge.innerText = `Pendiente (${pagados}/${nJug} pagados)`; }
else { badge.className = "badge-sin-pagar"; badge.innerHTML = `<i class="ri-error-warning-line" aria-hidden="true"></i>Sin pagar (0/${nJug})`; }
}
$('splitJugadoresContainer').addEventListener('click', e => {
const b = e.target.closest('button[data-j]');
if (b && !b.disabled) cambiarPagoJugador(parseInt(b.dataset.j, 10), b.dataset.m, b);
});
async function cambiarPagoJugador(numJugador, nuevoMetodo, btn) {
if (!reservaEnEdicion || !reservaEnEdicion.id) return;
document.querySelectorAll('#splitJugadoresContainer button').forEach(x => x.disabled = true);
const { data, error } = await supabaseClient.rpc('cobrar_jugador_atomic', {
p_reserva_id: reservaEnEdicion.id,
p_num_jugador: numJugador,
p_metodo_pago: nuevoMetodo,
p_empleado: nombreUsuario()
});
if (error) {
toast("Error al registrar el pago: " + error.message, 'err');
} else if (data) {
reservaEnEdicion.pagosJugadores = data.pagos;
reservaEnEdicion.pagoEstado = data.pago_estado;
}
actualizarVistasJugadoresSplit();
}
function cerrarModal() { cerrarOverlay('modalReserva'); }
async function guardarClienteSilencioso(nombre, telefono) {
const row = { nombre };
if (telefono) row.telefono = telefono;
const { error } = await supabaseClient.from('clientes').upsert(row, { onConflict: 'nombre' });
if (error) { console.warn('No se pudo guardar el cliente', error.message); return; }
const ex = datosLocales.clientes.find(c => String(c.nombre).toLowerCase() === nombre.toLowerCase());
if (ex) { if (telefono) ex.telefono = telefono; } else datosLocales.clientes.push(row);
dibujarClientesDatalist(datosLocales.clientes);
}
async function confirmarGuardarReserva() {
const cliente = $('modalCliente').value.trim();
if (!cliente) return toast("Introduce el nombre del cliente", 'warn');
const pistasSel = obtenerPistasSeleccionadasModal();
if (pistasSel.length === 0) return toast("Selecciona al menos una pista", 'warn');
const tipo = $('modalTipoReserva').value;
const esTorneo = tipo === 'Torneo';
const horaInicio = $('modalHora').value;
const iso = $('modalFecha').value;
if (!horaInicio || !iso) return toast("Indica fecha y hora de inicio", 'warn');
const telefono = $('modalTelefono').value.trim();
if (telefono && !/^[+\d][\d\s-]{5,19}$/.test(telefono)) return toast("El teléfono no parece válido", 'warn');
const duracionMin = esTorneo
? Math.round((parseFloat($('modalDuracionHoras').value) || 0) * 2) * 30
: (parseInt($('modalDuracion').value, 10) || 90);
if (duracionMin < 30) return toast("La duración mínima es de 30 minutos", 'warn');
const iniMin = timeToMin(horaInicio);
if (esFranjaBloqueada(iniMin, iniMin + duracionMin, tipo)) return toast("Horario no permitido para este tipo de reserva", 'err');
const numJugadores = parseInt($('modalNumJugadores').value, 10) || 4;
const importe = parseFloat($('modalPrecio').value);
if (isNaN(importe) || importe < 0) return toast("El precio no es válido", 'warn');
const idExistente = $('modalReservaId').value;
const repetirSemanas = (tipo === 'Pena' && !idExistente) ? Math.min(52, Math.max(1, parseInt($('modalRepetir').value, 10) || 1)) : 1;
const notas = $('modalNotas').value.trim();
const btn = $('btnGuardarReserva');
setBusy(btn, true, '<i class="ri-loader-4-line ri-spin" aria-hidden="true"></i>Guardando...');
try {
const payloadBase = {
cliente, telefono, hora_inicio: horaInicio, duracion_min: duracionMin, tipo_reserva: tipo,
jugadores: numJugadores, precio: importe, empleado: nombreUsuario()
};
if (idExistente) {
if (pistasSel.length !== 1) return toast("Al editar una reserva selecciona una única pista", 'warn');
const conf = await buscarConflicto({ pistas: pistasSel, fechas: [iso], iniMin, dur: duracionMin, excluirId: idExistente });
if (conf) return toast(`La pista '${pistasSel[0]}' ya está ocupada a las ${String(conf.hora_inicio).slice(0, 5)} por ${conf.cliente}`, 'err');
const upd = { ...payloadBase, fecha: iso, pista: pistasSel[0], updated_at: new Date().toISOString() };
if (notas !== String(reservaEnEdicion.notas || '').trim()) upd.notas = notas;
if (numJugadores !== reservaEnEdicion.numJugadoresOrig) {
const pagosOrig = String(reservaEnEdicion.pagosJugadores || "").split(",");
const eliminados = pagosOrig.slice(numJugadores).filter(p => p === 'Efectivo' || p === 'Tarjeta');
if (eliminados.length) return toast("No puedes reducir jugadores que ya han pagado. Quita antes su pago.", 'err');
const nuevos = pagosOrig.slice(0, numJugadores);
while (nuevos.length < numJugadores) nuevos.push("0");
upd.pagos_jugadores = nuevos.join(",");
upd.pago_estado = nuevos.every(p => p === 'Efectivo' || p === 'Tarjeta') ? 'Pagado' : 'Sin pagar';
}
const { error } = await supabaseClient.from('reservas').update(upd).eq('id', idExistente);
if (error) throw error;
await guardarClienteSilencioso(cliente, telefono);
toast("Reserva actualizada");
cerrarModal();
cargarReservasHoy();
return;
}
const fechas = [];
for (let w = 0; w < repetirSemanas; w++) fechas.push(sumarDiasISO(iso, w * 7));
const conf = await buscarConflicto({ pistas: pistasSel, fechas, iniMin, dur: duracionMin });
if (conf) {
return toast(`No se puede crear: '${conf.pista}' ya está ocupada el ${conf.fecha} (${String(conf.hora_inicio).slice(0, 5)}) por ${conf.cliente}`, 'err');
}
const serieId = repetirSemanas > 1 ? ("S_" + Date.now().toString(36)) : "";
const filas = [];
fechas.forEach(f => pistasSel.forEach(p => filas.push({
...payloadBase, pista: p, fecha: f, serie: serieId,
pago_estado: 'Sin pagar', pagos_jugadores: Array(numJugadores).fill('0').join(',')
})));
if (notas) filas.forEach(fila => { fila.notas = fila.fecha === fechas[0] ? notas : null; });
const { error } = await supabaseClient.from('reservas').insert(filas);
if (error) throw error;
await guardarClienteSilencioso(cliente, telefono);
toast(filas.length > 1 ? `${filas.length} reservas creadas` : "Reserva creada");
cerrarModal();
cargarReservasHoy();
} catch (err) {
console.error(err);
const msgErr = String(err.message || err);
toast(/notas/i.test(msgErr)
? "Falta la columna «notas» en Supabase. Ejecuta migracion_notas.sql en el SQL Editor."
: "Error al guardar la reserva: " + msgErr, 'err');
} finally {
setBusy(btn, false);
}
}
async function eliminarReservaRPC(alcance) {
const id = $('modalReservaId').value; if (!id) return;
const msg = alcance === 'serie' ? "¿Eliminar esta reserva y todas las siguientes de la serie?" : "¿Eliminar esta reserva? Se devolverán los pagos registrados.";
if (!confirm(msg)) return;
const { error } = await supabaseClient.rpc('eliminar_reserva_con_devolucion', { p_reserva_id: id, p_alcance: alcance, p_empleado: nombreUsuario() });
if (error) return toast("No se pudo eliminar: " + error.message, 'err');
cerrarModal();
toast(alcance === 'serie' ? "Serie eliminada" : "Reserva eliminada");
cargarReservasHoy(); cargarCajaHoy();
}
const confirmarEliminarSerie = () => eliminarReservaRPC('serie');
const confirmarEliminarReserva = () => eliminarReservaRPC('unica');
const totalItems = items => redondear2((items || []).reduce((s, i) => s + (Number(i.precio) || 0), 0));
function renderSelectorMesas() {
const nav = $('selectorMesas'); if (!nav) return;
nav.innerHTML = "";
listaMesas.forEach(m => {
const total = totalItems(cuentasMesas[m]);
const btn = document.createElement('button');
btn.type = 'button';
btn.className = `btn-mesa ${m === mesaSeleccionada ? 'activa' : ''}`;
btn.dataset.mesa = m;
btn.innerHTML = `${esc(m)} ${total > 0 ? `<span class="badge-total">${eur(total)}</span>` : ''}`;
nav.appendChild(btn);
});
renderTicketMesaActiva();
}
$('selectorMesas').addEventListener('click', e => {
const b = e.target.closest('.btn-mesa');
if (b) { mesaSeleccionada = b.dataset.mesa; renderSelectorMesas(); }
});
function renderTicketMesaActiva() {
const list = $('ticketItems');
$('tituloTicketMesa').innerText = mesaSeleccionada;
list.innerHTML = "";
const items = cuentasMesas[mesaSeleccionada] || [];
if (!items.length) {
list.innerHTML = '<li class="ticket-empty">Sin artículos · toca un producto para añadirlo</li>';
}
items.forEach((item, index) => {
const li = document.createElement('li');
li.dataset.index = index;
li.title = 'Toca para quitar';
li.innerHTML = `<span>${esc(item.nombre)}</span> <span>${eur(item.precio)} <i class="ri-close-line" aria-hidden="true"></i></span>`;
list.appendChild(li);
});
$('ticketTotal').innerText = eur(totalItems(items));
}
$('ticketItems').addEventListener('click', e => {
const li = e.target.closest('li[data-index]');
if (li) quitarDelTicket(parseInt(li.dataset.index, 10));
});
$('catTPVBotones').addEventListener('click', e => {
const b = e.target.closest('.btn-cat-filter'); if (!b) return;
categoriaTPVFiltro = b.dataset.cat;
document.querySelectorAll('#catTPVBotones .btn-cat-filter').forEach(x => x.classList.remove('active'));
b.classList.add('active');
dibujarCatalogo(datosLocales.productos);
});
function mutarMesa(mesa, fn) {
colaMesas = colaMesas.then(async () => {
try {
const { data, error } = await supabaseClient.from('mesas_bar').select('items').eq('mesa', mesa).maybeSingle();
if (error) throw error;
const items = fn(Array.isArray(data?.items) ? [...data.items] : []);
const { error: e2 } = await supabaseClient.from('mesas_bar').upsert({ mesa, items }, { onConflict: 'mesa' });
if (e2) throw e2;
cuentasMesas[mesa] = items;
renderSelectorMesas();
} catch (err) {
console.error(err);
toast("No se pudo actualizar la cuenta: " + (err.message || err), 'err');
cargarMesasBar();
}
});
return colaMesas;
}
function agregarAlTicket(prod) {
const mesa = mesaSeleccionada;
cuentasMesas[mesa] = [...(cuentasMesas[mesa] || []), prod];
renderSelectorMesas();
return mutarMesa(mesa, items => { items.push(prod); return items; });
}
function quitarDelTicket(index) {
const mesa = mesaSeleccionada;
const item = (cuentasMesas[mesa] || [])[index];
if (!item) return;
cuentasMesas[mesa] = cuentasMesas[mesa].filter((_, i) => i !== index);
renderSelectorMesas();
return mutarMesa(mesa, items => {
let i = items[index] && items[index].nombre === item.nombre ? index : items.findIndex(x => x.nombre === item.nombre && x.precio === item.precio);
if (i >= 0) items.splice(i, 1);
return items;
});
}
async function cobrarMesaActiva(metodoPago) {
if (cobrando) return;
cobrando = true;
const botones = [$('btnCobrarEfectivo'), $('btnCobrarTarjeta')];
botones.forEach(b => b.disabled = true);
const msg = $('msgVenta');
const mesa = mesaSeleccionada;
try {
await colaMesas;
const { data, error } = await supabaseClient.from('mesas_bar').select('items').eq('mesa', mesa).maybeSingle();
if (error) throw error;
const items = Array.isArray(data?.items) ? data.items : [];
if (!items.length) { msg.style.color = 'var(--muted)'; msg.innerText = 'La cuenta está vacía'; return; }
const total = totalItems(items);
const { error: eVenta } = await supabaseClient.from('ventas').insert({
tipo: 'Bar', concepto: `${mesa}: ${items.map(i => i.nombre).join(', ')}`.slice(0, 500),
importe: total, metodo_pago: metodoPago, empleado: nombreUsuario()
});
if (eVenta) throw eVenta;
const { error: eClear } = await supabaseClient.from('mesas_bar').upsert({ mesa, items: [] }, { onConflict: 'mesa' });
cuentasMesas[mesa] = [];
renderSelectorMesas();
if (eClear) toast("Venta registrada, pero no se pudo vaciar la mesa. Vacíala a mano para no cobrar dos veces.", 'warn', 8000);
msg.style.color = 'var(--green)';
msg.innerText = `Cobrado ${eur(total)} (${metodoPago})`;
setTimeout(() => { if (msg.innerText.startsWith('Cobrado')) msg.innerText = ''; }, 5000);
cargarCajaHoy();
} catch (err) {
console.error(err);
msg.style.color = 'var(--red)';
msg.innerText = 'No se pudo cobrar: ' + (err.message || err);
} finally {
cobrando = false;
botones.forEach(b => b.disabled = false);
}
}
function dibujarCatalogo(productos) {
const grid = $('catalogGrid');
if (grid) {
const q = ($('buscarTPV')?.value || '').toLowerCase().trim();
const lista = (productos || []).filter(p =>
p.estado !== 'Eliminado' && p.estado !== 'Inactivo' &&
(categoriaTPVFiltro === 'Todos' || p.categoria === categoriaTPVFiltro) &&
(!q || String(p.nombre).toLowerCase().includes(q)));
grid.innerHTML = lista.length ? lista.map(p =>
`<button type="button" class="btn-product" data-id="${esc(p.id)}">${esc(p.nombre)} <span>${eur(p.precio)}</span></button>`).join('')
: '<p style="color:var(--muted);font-weight:600">No hay productos en esta categoría.</p>';
}
filtrarGestionCatalogo();
}
$('catalogGrid').addEventListener('click', e => {
const b = e.target.closest('.btn-product'); if (!b) return;
const p = (datosLocales.productos || []).find(x => String(x.id) === b.dataset.id);
if (p) agregarAlTicket({ id: p.id, nombre: p.nombre, precio: parseFloat(p.precio) });
});
function filtrarGestionCatalogo() {
const tbody = $('tablaProductosBody'); if (!tbody) return;
const q = ($('buscarProdGestion')?.value || '').toLowerCase().trim();
const cat = $('catFilterGestion')?.value || 'Todos';
const prods = (datosLocales.productos || []).filter(p =>
p.estado !== 'Eliminado' && (cat === 'Todos' || p.categoria === cat) && (!q || String(p.nombre).toLowerCase().includes(q)));
if (!prods.length) { tbody.innerHTML = `<tr><td colspan="5" class="tabla-empty">No se encontraron artículos</td></tr>`; return; }
tbody.innerHTML = prods.map(p => `
<tr>
<td><b>${esc(p.nombre)}</b></td>
<td><b>${eur(p.precio)}</b></td>
<td>${esc(p.categoria)}</td>
<td><span style="color:${p.estado === 'Activo' ? 'var(--green)' : 'var(--amber)'};font-weight:800">${p.estado === 'Activo' ? '<i class="ri-checkbox-circle-line" aria-hidden="true"></i>Activo' : '<i class="ri-pause-circle-line" aria-hidden="true"></i>Inactivo'}</span></td>
<td>
<button type="button" class="btn-edit-prod" data-act="edit" data-id="${esc(p.id)}"><i class="ri-edit-line" aria-hidden="true"></i>Editar</button>
<button type="button" class="btn-del-prod" data-act="del" data-id="${esc(p.id)}"><i class="ri-delete-bin-line" aria-hidden="true"></i>Eliminar</button>
</td>
</tr>`).join('');
}
$('tablaProductosBody').addEventListener('click', e => {
const b = e.target.closest('button[data-act]'); if (!b) return;
if (b.dataset.act === 'edit') abrirModalEditarProducto(b.dataset.id);
else eliminarProductoCat(b.dataset.id);
});
function abrirModalNuevoProducto() {
$('modalProductoTitulo').innerText = "Nuevo artículo";
$('modalProdId').value = "";
$('modalProdNombre').value = "";
$('modalProdPrecio').value = "";
$('modalProdCat').value = "Bebidas";
$('modalProdEstado').value = "Activo";
abrirOverlay('modalProducto');
setTimeout(() => $('modalProdNombre').focus(), 60);
}
function abrirModalEditarProducto(id) {
const p = (datosLocales.productos || []).find(x => String(x.id) === String(id));
if (!p) return;
$('modalProductoTitulo').innerText = "Editar artículo";
$('modalProdId').value = p.id;
$('modalProdNombre').value = p.nombre;
$('modalProdPrecio').value = p.precio;
$('modalProdCat').value = p.categoria;
$('modalProdEstado').value = p.estado || "Activo";
abrirOverlay('modalProducto');
}
function cerrarModalProducto() { cerrarOverlay('modalProducto'); }
async function guardarProductoModal() {
const id = $('modalProdId').value;
const nombre = $('modalProdNombre').value.trim();
const precio = parseFloat($('modalProdPrecio').value);
const categoria = $('modalProdCat').value;
const estado = $('modalProdEstado').value;
if (!nombre || isNaN(precio) || precio < 0) return toast("Revisa el nombre y el precio del artículo", 'warn');
const btn = $('btnGuardarProducto');
setBusy(btn, true, '<i class="ri-loader-4-line ri-spin" aria-hidden="true"></i>Guardando...');
try {
const q = id
? supabaseClient.from('productos').update({ nombre, precio, categoria, estado }).eq('id', id)
: supabaseClient.from('productos').insert({ nombre, precio, categoria, estado });
const { error } = await q;
if (error) throw error;
cerrarModalProducto();
toast("Artículo guardado");
cargarProductos();
} catch (err) {
toast("No se pudo guardar el artículo: " + (err.message || err), 'err');
} finally { setBusy(btn, false); }
}
async function eliminarProductoCat(idProd) {
if (!confirm("¿Deseas eliminar este artículo del catálogo?")) return;
const { error } = await supabaseClient.from('productos').update({ estado: 'Eliminado' }).eq('id', idProd);
if (error) return toast("No se pudo eliminar: " + error.message, 'err');
toast("Artículo eliminado");
cargarProductos();
}
async function fichar(tipo, btn) {
const msg = $('msgFichaje');
if (ultimoFichaje && ultimoFichaje.tipo === tipo) {
if (!confirm(`Tu último fichaje ya fue de ${tipo}. ¿Registrar otra ${tipo} igualmente?`)) return;
}
setBusy(btn, true);
try {
const { error } = await supabaseClient.from('fichajes').insert({ empleado: usuarioSesion.user, tipo });
if (error) throw error;
msg.style.color = 'var(--green)';
msg.innerText = `Fichaje de ${tipo} registrado correctamente`;
await cargarMisFichajes();
} catch (err) {
msg.style.color = 'var(--red)';
msg.innerText = "Error: " + (err.message || err);
} finally { setBusy(btn, false); }
}
async function cargarMisFichajes() {
const tbody = $('tablaFichajesBody');
if (!tbody || !usuarioSesion) return;
const { data, error } = await supabaseClient.from('fichajes').select('*').eq('empleado', usuarioSesion.user).order('created_at', { ascending: false }).limit(30);
if (error) { tbody.innerHTML = `<tr><td colspan="3" class="tabla-empty" style="color:var(--red)">Error al cargar fichajes: ${esc(error.message)}</td></tr>`; return; }
if (!data || !data.length) { ultimoFichaje = null; $('estadoFichaje').innerText = ''; tbody.innerHTML = `<tr><td colspan="3" class="tabla-empty">No hay registros de fichajes aún</td></tr>`; return; }
const fmt = f => {
const d = new Date(f.created_at || f.fecha_hora);
return isNaN(d.getTime()) ? (f.created_at || f.fecha_hora || '-') : d.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'medium' });
};
ultimoFichaje = { tipo: data[0].tipo };
$('estadoFichaje').innerText = `Último fichaje: ${data[0].tipo} · ${fmt(data[0])}`;
tbody.innerHTML = data.map(f => {
const ent = f.tipo === 'Entrada';
return `<tr>
<td><b>${esc(fmt(f))}</b></td>
<td><span class="badge-fichaje ${ent ? 'in' : 'out'}">${ent ? '<i class="ri-login-box-line" aria-hidden="true"></i>Entrada' : '<i class="ri-logout-box-line" aria-hidden="true"></i>Salida'}</span></td>
<td><b>${esc(f.empleado)}</b></td></tr>`;
}).join('');
}
function dibujarCaja(caja) {
$('cajaEfectivo').innerText = eur(caja.totalEfectivo);
$('cajaTarjeta').innerText = eur(caja.totalTarjeta);
$('cajaTotal').innerText = eur(caja.totalGeneral);
const iso = $('fechaCuadrante').value || fechaLocalISO();
$('cajaFechaTxt').innerText = fechaBonita(iso);
}
function calcCierre() {
const v = id => parseFloat($(id).value) || 0, c = datosLocales.caja || {};
const ef = redondear2(v('cjBilletes') + v('cjMonedas'));
const dE = redondear2(ef - (c.totalEfectivo || 0)), dD = redondear2(v('cjDatafono') - (c.totalTarjeta || 0));
const f = n => `<b class="${Math.abs(n) < 0.005 ? 'dif-ok' : 'dif-ko'}">${n > 0 ? '+' : ''}${eur(n)}</b>`;
$('cjEfectivo').value = eur(ef);
$('cjResumen').innerHTML = `<span>Efectivo en sistema ${eur(c.totalEfectivo)} · ${f(dE)}</span><span>Datáfono en sistema ${eur(c.totalTarjeta)} · ${f(dD)}</span>`;
}
async function cerrarCajaHoy() {
const btn = $('btnCerrarCaja'), msg = $('msgCierre');
const bil = parseFloat($('cjBilletes').value) || 0, mon = parseFloat($('cjMonedas').value) || 0, dat = parseFloat($('cjDatafono').value) || 0;
if (bil < 0 || mon < 0 || dat < 0) { msg.style.color = 'var(--red)'; msg.innerText = 'Los importes no pueden ser negativos'; return; }
const fecha = $('fechaCuadrante').value || fechaLocalISO();
setBusy(btn, true, '<i class="ri-loader-4-line ri-spin" aria-hidden="true"></i>Cerrando...');
try {
await cargarCajaHoy();
const c = datosLocales.caja, ef = redondear2(bil + mon);
const { data: ya, error: eCons } = await supabaseClient.from('cierres').select('fecha').eq('fecha', fecha).limit(1);
if (eCons) throw eCons;
if (ya && ya.length && !confirm(`Ya existe un cierre de caja para el ${fecha}. ¿Registrar otro igualmente?`)) return;
const dE = redondear2(ef - c.totalEfectivo), dD = redondear2(dat - c.totalTarjeta);
if ((Math.abs(dE) >= 0.005 || Math.abs(dD) >= 0.005) && !confirm(`Hay descuadre (efectivo ${dE.toFixed(2)} €, datáfono ${dD.toFixed(2)} €). ¿Cerrar caja de todos modos?`)) return;
const { error } = await supabaseClient.from('cierres').insert({
fecha, efectivo_sistema: c.totalEfectivo, tarjeta: c.totalTarjeta, total: c.totalGeneral,
billetes: bil, monedas: mon, efectivo_contado: ef, datafono_contado: dat,
dif_efectivo: dE, dif_datafono: dD, cerrado_por: usuarioSesion.user
});
if (error) throw error;
msg.style.color = 'var(--green)'; msg.innerText = 'Caja cerrada correctamente';
cargarHistorialCaja();
} catch (err) {
msg.style.color = 'var(--red)'; msg.innerText = 'No se pudo cerrar la caja: ' + (err.message || err);
} finally { setBusy(btn, false); }
}
async function cargarHistorialCaja() {
const tb = $('histCajaBody');
const { data, error } = await supabaseClient.from('cierres').select('*').order('fecha', { ascending: false }).limit(60);
if (error) { tb.innerHTML = `<tr><td colspan="7" class="tabla-empty" style="color:var(--red)">Error: ${esc(error.message)}</td></tr>`; return; }
const dif = n => { const x = Number(n) || 0; return `<b class="${Math.abs(x) < 0.005 ? 'dif-ok' : 'dif-ko'}">${x > 0 ? '+' : ''}${eur(x)}</b>`; };
tb.innerHTML = (data || []).map(d => `<tr>
<td><b>${esc(d.fecha)}</b></td><td>${eur(d.efectivo_sistema)}</td><td>${eur(d.tarjeta)}</td>
<td><b>${eur(d.total)}</b></td><td>${dif(d.dif_efectivo)}</td><td>${dif(d.dif_datafono)}</td>
<td><i class="ri-lock-line" aria-hidden="true"></i>${esc(d.cerrado_por)}</td></tr>`).join('') || '<tr><td colspan="7" class="tabla-empty">—</td></tr>';
}
function dibujarTarifas(t) {
if (!t) return;
if (t.semanaManana != null) $('tarSemMan').value = t.semanaManana;
if (t.semanaTarde != null) $('tarSemTar').value = t.semanaTarde;
if (t.finde != null) $('tarFinde').value = t.finde;
}
async function guardarTarifasUI() {
const msg = $('msgTarifas'), btn = $('btnGuardarTarifas');
const vals = ['tarSemMan', 'tarSemTar', 'tarFinde'].map(id => parseFloat($(id).value));
if (vals.some(v => isNaN(v) || v < 0)) { msg.style.color = 'var(--red)'; msg.innerText = 'Introduce tres tarifas válidas (≥ 0)'; return; }
setBusy(btn, true, '<i class="ri-loader-4-line ri-spin" aria-hidden="true"></i>Guardando...');
const { error } = await supabaseClient.from('tarifas').upsert([
{ franja: 'Entre semana mañana', precio_90min: vals[0] },
{ franja: 'Entre semana tarde', precio_90min: vals[1] },
{ franja: 'Fin de semana', precio_90min: vals[2] }
], { onConflict: 'franja' });
setBusy(btn, false);
if (error) { msg.style.color = 'var(--red)'; msg.innerText = 'No se pudieron guardar: ' + error.message; return; }
datosLocales.tarifas = { semanaManana: vals[0], semanaTarde: vals[1], finde: vals[2] };
msg.style.color = 'var(--green)'; msg.innerText = "Tarifas actualizadas";
setTimeout(() => { msg.innerText = ''; }, 4000);
}
const PP_TIPO_CLASE = { Pena: 't-pena', Torneo: 't-torneo', Entrenamiento: 't-entreno' };
function estadoPagoReserva(r) {
const n = parseInt(r.numJugadores, 10) || 4;
const arr = String(r.pagosJugadores || '').split(',');
let pagados = 0;
for (let i = 0; i < n; i++) {
const p = arr[i];
if (p === 'Efectivo' || p === 'Tarjeta' || (p && p !== '0')) pagados++;
}
return { n, pagados, total: pagados >= n };
}
function htmlPaginaImpresion(iso, nombreFranja, meta, reservas, segIni, segFin) {
const span = segFin - segIni;
const pctHora = 100 / (span / 60), pctMedia = 100 / (span / 30);
let etiquetas = '';
for (let m = Math.ceil(segIni / 60) * 60; m < segFin; m += 60) {
etiquetas += `<span style="left:${((m - segIni) / span * 100).toFixed(3)}%">${minToTimeStr(m)}</span>`;
}
const filas = listaPistas.map(pista => {
const bloques = reservas.filter(r => r.pista === pista).map(r => {
const a0 = timeToMin(r.horaInicio), b0 = a0 + (parseInt(r.duracionMin, 10) || 90);
const a = Math.max(a0, segIni), b = Math.min(b0, segFin);
if (b <= a) return '';
const pg = estadoPagoReserva(r);
const pagoTxt = pg.total ? '✔ Pagado' : (pg.pagados > 0 ? `Pagan ${pg.pagados}/${pg.n}` : 'Sin pagar');
const claseTipo = PP_TIPO_CLASE[r.tipoReserva] || '';
let cls = 'pp-res ' + claseTipo;
if (pg.total && !claseTipo) cls += ' pagado';
if (a0 < segIni) cls += ' clip-l';
if (b0 > segFin) cls += ' clip-r';
const mini = (b - a) / span * 254 < 40;
if (mini) cls += ' pp-mini';
const tipo = r.tipoReserva && r.tipoReserva !== 'Normal' ? ` · ${r.tipoReserva === 'Pena' ? 'Peña' : esc(r.tipoReserva)}` : '';
const nota = String(r.notas || '').replace(/\s+/g, ' ').trim();
return `<div class="${cls}" style="left:${((a - segIni) / span * 100).toFixed(3)}%;width:${((b - a) / span * 100).toFixed(3)}%">
<div class="pp-name">${r.serie ? '↻ ' : ''}${esc(r.cliente)}</div>
<div class="pp-sub">${minToTimeStr(a0)}–${minToTimeStr(b0)}${mini ? '' : ` · ${pagoTxt}${tipo}`}</div>
${nota ? `<div class="pp-note">✎ ${esc(nota)}</div>` : ''}
</div>`;
}).join('');
return `<div class="pp-row"><div class="pp-court">${esc(pista)}</div>
<div class="pp-tl pp-line" style="background-size:${pctHora}% 100%, ${pctMedia}% 100%">${bloques}</div></div>`;
}).join('');
const fecha = fechaBonita(iso);
return `<section class="pp-page">
<div class="pp-head">
<img src="./Geopadel.png" alt="Geopadel">
<div class="pp-title"><h1>${esc(fecha.charAt(0).toUpperCase() + fecha.slice(1))}</h1><p>${nombreFranja} · ${minToTimeStr(segIni)} – ${minToTimeStr(segFin)}</p></div>
<div class="pp-meta">${meta}</div>
</div>
<div class="pp-grid">
<div class="pp-hours"><div class="pp-court">Pista / Hora</div><div class="pp-tl">${etiquetas}</div></div>
${filas}
</div>
</section>`;
}
async function imprimirDia() {
const btn = $('btnImprimir');
setBusy(btn, true);
try {
await cargarReservasHoy();
const iso = $('fechaCuadrante').value || fechaLocalISO();
const reservas = (datosLocales.reservas || []).filter(r => r.fecha === iso);
if (!reservas.length) { toast('No hay reservas este día para imprimir', 'warn'); return; }
let mIni = 9 * 60, tFin = 23 * 60 + 30;
reservas.forEach(r => {
const a = timeToMin(r.horaInicio), b = a + (parseInt(r.duracionMin, 10) || 90);
if (a < mIni) mIni = Math.floor(a / 60) * 60;
if (b > tFin) tFin = Math.ceil(b / 30) * 30;
});
const franjas = [
{ nombre: 'Mañana', ini: mIni, fin: bloqueDescansoInicio },
{ nombre: 'Mediodía', ini: bloqueDescansoInicio, fin: bloqueDescansoFin },
{ nombre: 'Tarde', ini: bloqueDescansoFin, fin: tFin }
].filter(f => reservas.some(r => {
const a = timeToMin(r.horaInicio), b = a + (parseInt(r.duracionMin, 10) || 90);
return a < f.fin && b > f.ini;
}));
const impreso = new Date().toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
const meta = `Reservas del día: ${reservas.length} · Ocupación ${$('statOcupacion').innerText}<br>Impreso: ${esc(impreso)}`;
const area = $('printArea');
area.innerHTML = franjas.map(f => htmlPaginaImpresion(iso, f.nombre, meta, reservas, f.ini, f.fin)).join('');
await Promise.all(Array.from(area.querySelectorAll('img')).map(im => im.complete ? null : new Promise(res => { im.onload = im.onerror = res; })));
window.print();
} catch (err) {
console.error(err);
toast('No se pudo preparar la impresión: ' + (err.message || err), 'err');
} finally {
setBusy(btn, false);
}
}
window.addEventListener('afterprint', () => { const a = $('printArea'); if (a) a.innerHTML = ''; });
document.addEventListener('keydown', e => {
if (e.key !== 'Escape') return;
if ($('modalProducto').classList.contains('open')) cerrarModalProducto();
else if ($('modalReserva').classList.contains('open')) cerrarModal();
});
document.querySelectorAll('.modal-overlay').forEach(ov => {
let abajoEnFondo = false;
ov.addEventListener('mousedown', e => { abajoEnFondo = e.target === ov; });
ov.addEventListener('mouseup', e => {
if (abajoEnFondo && e.target === ov) { if (ov.id === 'modalProducto') cerrarModalProducto(); else cerrarModal(); }
abajoEnFondo = false;
});
});
window.addEventListener('DOMContentLoaded', () => { iniciarTema(); estadoRed(); comprobarSesion(); });
let promptInstalacion = null;
const btnInstalar = () => document.getElementById('btnInstalar');
const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const yaInstalada = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
window.addEventListener('beforeinstallprompt', e => {
e.preventDefault();
promptInstalacion = e;
if (btnInstalar()) btnInstalar().classList.add('visible');
});
window.addEventListener('appinstalled', () => {
promptInstalacion = null;
if (btnInstalar()) btnInstalar().classList.remove('visible');
});
async function instalarApp() {
if (!promptInstalacion) { toast('En Safari pulsa Compartir y elige «Añadir a pantalla de inicio»', 'ok', 7000); return; }
promptInstalacion.prompt();
await promptInstalacion.userChoice;
promptInstalacion = null;
if (btnInstalar()) btnInstalar().classList.remove('visible');
}
if (esIOS && !yaInstalada() && btnInstalar()) btnInstalar().classList.add('visible');
if ('serviceWorker' in navigator) {
window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { }));
}