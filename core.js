/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
// Constantes, estado global y utilidades base (sin dependencias).

const DOMINIO_LOGIN = '@geopadel.app';
const SESION_MAX_MS = 8 * 3600 * 1000;
const INACTIVIDAD_MAX_MS = 60 * 60 * 1000;
const CLAVE_ULT_ACT = 'gp-ult-actividad';
const CLAVE_SESION_INI = 'gp-sesion-ini';

const APERT_MIN = 8 * 60;
const bloqueDescansoInicio = 14 * 60;
const bloqueDescansoFin = 17 * 60;
const CIERRE_MIN = 22 * 60;

const listaPistas = ["1 PADEL MASTER", "Pista 2", "Pista 3", "Pista 4", "Pista 5", "Pista 6", "Pista 7", "Pista 8", "Pista 9"];
const listaMesas = ["Suelto", "Mesa 1", "Mesa 2", "Mesa 3", "Mesa 4", "Mesa 5", "Mesa 6", "Barra"];

const TARIFAS_DEFECTO = { semanaManana: { 90: 20 }, semanaTarde: { 90: 26 }, finde: { 90: 26 } };
const TARIFAS_IDS = {
    semanaManana: ['tarSemMan60', 'tarSemMan', 'tarSemMan120'],
    semanaTarde: ['tarSemTar60', 'tarSemTar', 'tarSemTar120'],
    finde: ['tarFinde60', 'tarFinde', 'tarFinde120']
};
const TARIFAS_FRANJAS = {
    semanaManana: 'Entre semana mañana',
    semanaTarde: 'Entre semana tarde',
    finde: 'Fin de semana'
};

const ROLES_ADMIN = ['trabajador', 'jefa'];
const FILTRO_NO_CANCELADA = 'estado.is.null,estado.neq.Cancelada';

// ---- Estado global compartido ----
let horaInicioGrid = 8, horaFinGrid = 21.5;
let usuarioSesion = null;
let datosLocales = {
    productos: [], clientes: [], reservas: [], tarifas: {},
    caja: { totalEfectivo: 0, totalTarjeta: 0, totalGeneral: 0 }
};
let reservaEnEdicion = null;
let dragGrabOffsetY = 0;
let suprimirClick = false;
let scrollAhoraPendiente = true;
let canalRealtime = null;
let canalConError = false;
let mesaSeleccionada = "Mesa 1";
let cuentasMesas = {};
listaMesas.forEach(m => cuentasMesas[m] = []);
let categoriaTPVFiltro = "Todos";
let colaMesas = Promise.resolve();
let cobrando = false;
let ultimoFichaje = null;

// ---- Derivados de sesión ----
const nombreUsuario = () => usuarioSesion ? (usuarioSesion.user || usuarioSesion.nombre) : 'Sistema';
const esJefa = () => !!usuarioSesion && String(usuarioSesion.rol || '').trim().toLowerCase() === 'jefa';
const esPersonal = () => !!usuarioSesion && ROLES_ADMIN.includes(String(usuarioSesion.rol || '').trim().toLowerCase());

// ---- Sesión / actividad ----
function marcarInicioSesion() {
    try {
        const ahora = String(Date.now());
        localStorage.setItem(CLAVE_SESION_INI, ahora);
        localStorage.setItem(CLAVE_ULT_ACT, ahora);
    } catch (e) { }
}
function registrarActividad() {
    try { localStorage.setItem(CLAVE_ULT_ACT, String(Date.now())); } catch (e) { }
}
['click', 'mousemove', 'keydown', 'scroll', 'touchstart'].forEach(evt => {
    window.addEventListener(evt, debounce(registrarActividad, 1000), { passive: true });
});
function sesionCaducada() {
    let ini = 0, ult = 0;
    try {
        ini = parseInt(localStorage.getItem(CLAVE_SESION_INI), 10) || 0;
        ult = parseInt(localStorage.getItem(CLAVE_ULT_ACT), 10) || ini;
    } catch (e) { }
    const ahora = Date.now();
    return (!!ini && ahora - ini > SESION_MAX_MS) || (!!ult && ahora - ult > INACTIVIDAD_MAX_MS);
}

// ---- Fechas / tiempos ----
function inicializarFechaHoy() { $('fechaCuadrante').value = fechaLocalISO(); }

function obtenerCierreMin(iso) {
    const dateIso = iso || ($('fechaCuadrante') ? $('fechaCuadrante').value : fechaLocalISO());
    const [y, m, d] = dateIso.split('-').map(Number);
    const day = new Date(y, m - 1, d, 12).getDay(); // 0: Dom … 6: Sáb
    if (day >= 1 && day <= 4) return 23 * 60 + 30; // L-J 23:30
    return 22 * 60; // V-D 22:00
}

function debounce(fn, ms) {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
function rangoDiaISO(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return [new Date(y, m - 1, d, 0, 0, 0).toISOString(), new Date(y, m - 1, d + 1, 0, 0, 0).toISOString()];
}
function timeToMin(tStr) {
    const parts = String(tStr || '0:0').split(':');
    return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
}
function minToTimeStr(min) {
    const h = Math.floor(min / 60), m = min % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
function esCerrado(min, iso) {
    const cierre = obtenerCierreMin(iso);
    return min < (9 * 60) || (min >= bloqueDescansoInicio && min < bloqueDescansoFin) || min >= cierre;
}
function esFranjaBloqueada(iniMin, finMin, tipoReserva = "Normal", iso) {
    const cierre = obtenerCierreMin(iso);
    if (tipoReserva === "Torneo") return iniMin < (8 * 60) || finMin > (24 * 60);
    if (iniMin < (9 * 60) || finMin > cierre) return true;
    if (iniMin < bloqueDescansoFin && finMin > bloqueDescansoInicio) return true;
    return false;
}
function pxPorMin() {
    const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--slot-h'));
    return (v || 30) / 30;
}
function esFinde(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    const w = new Date(y, m - 1, d, 12).getDay();
    return w === 0 || w === 6;
}

// ---- Overlays / foco ----
const pilaFoco = [];
const FOCABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
function abrirOverlay(id) {
    const ov = $(id);
    if (!ov.classList.contains('open')) pilaFoco.push(document.activeElement);
    ov.setAttribute('tabindex', '-1');
    ov.classList.add('open');
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
        if (ov.contains(document.activeElement)) return;
        const f = Array.from(ov.querySelectorAll(FOCABLE)).find(e => e.offsetParent !== null);
        (f || ov).focus();
    }, 0);
}
function cerrarOverlay(id) {
    const ov = $(id);
    const estaba = ov.classList.contains('open');
    ov.classList.remove('open');
    if (!document.querySelector('.modal-overlay.open')) document.body.style.overflow = '';
    if (estaba) {
        const prev = pilaFoco.pop();
        if (prev && prev.focus && document.contains(prev)) prev.focus();
    }
}
document.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const ov = Array.from(document.querySelectorAll('.modal-overlay.open')).pop();
    if (!ov) return;
    const f = Array.from(ov.querySelectorAll(FOCABLE)).filter(x => x.offsetParent !== null);
    if (!f.length) { e.preventDefault(); ov.focus(); return; }
    const primero = f[0], ultimo = f[f.length - 1], dentro = ov.contains(document.activeElement);
    if (e.shiftKey && (!dentro || document.activeElement === primero || document.activeElement === ov)) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && (!dentro || document.activeElement === ultimo)) { e.preventDefault(); primero.focus(); }
});