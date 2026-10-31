/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
const DOMINIO_LOGIN = "@geopadel.app";
const SESION_MAX_MS = 8 * 3600 * 1000;
const INACTIVIDAD_MAX_MS = 8 * 3600 * 1000;
const AVISO_SESION_MS = 2 * 60 * 1000;
const CLAVE_ULT_ACT = "gp-ult-actividad";
const CLAVE_SESION_INI = "gp-sesion-ini";
let APERT_MIN = 8 * 60;
let RESERVA_INI_MIN = 9 * 60;
let CIERRE_SEMANA_MIN = 23 * 60 + 30;
let CIERRE_FINDE_MIN = 22 * 60;
let bloqueDescansoInicio = 14 * 60;
let bloqueDescansoFin = 17 * 60;
let FONDO_CAJA_DEF = 100;
let CFG_PANEL_CARGADA = false;
let _ultimaCargaDatos = 0;
const RECARGA_DATOS_MIN_MS = 30000;
let listaPistas = [
  "1 PADEL MASTER",
  "Pista 2",
  "Pista 3",
  "Pista 4",
  "Pista 5",
  "Pista 6",
  "Pista 7",
  "Pista 8",
  "Pista 9",
];
let listaMesas = [
  "Suelto",
  "Mesa 1",
  "Mesa 2",
  "Mesa 3",
  "Mesa 4",
  "Mesa 5",
  "Mesa 6",
  "Barra",
];
const TARIFAS_DEFECTO = {
  semanaManana: { 90: 20 },
  semanaTarde: { 90: 26 },
  finde: { 90: 26 },
  entrenamiento: { 60: 10, 90: 15, 120: 20 },
};
const TARIFAS_IDS = {
  semanaManana: ["tarSemMan60", "tarSemMan", "tarSemMan120"],
  semanaTarde: ["tarSemTar60", "tarSemTar", "tarSemTar120"],
  finde: ["tarFinde60", "tarFinde", "tarFinde120"],
  entrenamiento: ["tarEntreno60", "tarEntreno", "tarEntreno120"],
};
const TARIFAS_FRANJAS = {
  semanaManana: "Entre semana mañana",
  semanaTarde: "Entre semana tarde",
  finde: "Fin de semana",
  entrenamiento: "Entrenamiento",
};
const ROLES_ADMIN = ["trabajador", "jefa"];
const FILTRO_NO_CANCELADA = "estado.is.null,estado.neq.Cancelada";
let horaInicioGrid = 8,
  horaFinGrid = 21.5;
let usuarioSesion = null;
let datosLocales = {
  productos: [],
  clientes: [],
  reservas: [],
  tarifas: {},
  bloqueos: [],
  festivos: [],
  caja: { totalEfectivo: 0, totalTarjeta: 0, totalGeneral: 0 },
};
let reservaEnEdicion = null;
let dragGrabOffsetY = 0;
let suprimirClick = false;
let scrollAhoraPendiente = true;
let canalRealtime = null;
let canalConError = false;
let mesaSeleccionada = "Mesa 1";
let cuentasMesas = {};
listaMesas.forEach((m) => (cuentasMesas[m] = []));
let categoriaTPVFiltro = "Todos";
let colaMesas = Promise.resolve();
let cobrando = false;
let ultimoFichaje = null;
const nombreUsuario = () =>
  usuarioSesion ? usuarioSesion.user || usuarioSesion.nombre : "Sistema";
const esJefa = () =>
  !!usuarioSesion &&
  String(usuarioSesion.rol || "")
    .trim()
    .toLowerCase() === "jefa";
const esPersonal = () =>
  !!usuarioSesion &&
  ROLES_ADMIN.includes(
    String(usuarioSesion.rol || "")
      .trim()
      .toLowerCase(),
  );
const esEntrenador = () =>
  !!usuarioSesion &&
  String(usuarioSesion.rol || "")
    .trim()
    .toLowerCase() === "entrenador";

async function cargarConfigPanel() {
  if (CFG_PANEL_CARGADA || !supabaseClient) return;
  try {
    let cache = null;
    try {
      cache = JSON.parse(localStorage.getItem("gp-panel-config") || "null");
    } catch (e) {}
    if (cache && cache.t && Date.now() - cache.t < 86400000 && cache.data) {
      aplicarConfigPanel(cache.data);
      CFG_PANEL_CARGADA = true;
      if (typeof renderSelectorMesas === "function") renderSelectorMesas();
      supabaseClient
        .rpc("panel_config")
        .then((r) => {
          if (r && r.data) {
            aplicarConfigPanel(r.data);
            try {
              localStorage.setItem(
                "gp-panel-config",
                JSON.stringify({ t: Date.now(), data: r.data }),
              );
            } catch (e) {}
          }
        })
        .catch(() => {});
      return;
    }
    const { data, error } = await supabaseClient.rpc("panel_config");
    if (error || !data) return;
    aplicarConfigPanel(data);
    try {
      localStorage.setItem(
        "gp-panel-config",
        JSON.stringify({ t: Date.now(), data }),
      );
    } catch (e) {}
    CFG_PANEL_CARGADA = true;
    if (typeof renderSelectorMesas === "function") renderSelectorMesas();
  } catch (e) {
    console.error("config panel", e);
  }
}

function aplicarConfigPanel(data) {
  if (!data) return;
  if (Array.isArray(data.pistas) && data.pistas.length)
    listaPistas = data.pistas;
  if (Array.isArray(data.mesas) && data.mesas.length) {
    listaMesas = data.mesas;
    cuentasMesas = {};
    listaMesas.forEach((m) => (cuentasMesas[m] = []));
  }
  const h = data.horarios || {};
  if (Number.isFinite(h.apertura_min)) APERT_MIN = h.apertura_min;
  if (Number.isFinite(h.reserva_inicio_min))
    RESERVA_INI_MIN = h.reserva_inicio_min;
  if (Number.isFinite(h.descanso_inicio_min))
    bloqueDescansoInicio = h.descanso_inicio_min;
  if (Number.isFinite(h.descanso_fin_min))
    bloqueDescansoFin = h.descanso_fin_min;
  if (Number.isFinite(h.cierre_semana_min))
    CIERRE_SEMANA_MIN = h.cierre_semana_min;
  if (Number.isFinite(h.cierre_finde_min))
    CIERRE_FINDE_MIN = h.cierre_finde_min;
  if (Number.isFinite(data.fondo_caja)) FONDO_CAJA_DEF = data.fondo_caja;
}

function mapearReserva(r) {
  return {
    id: r.id,
    cliente: r.cliente || "",
    nombreEntidad: r.nombre_entidad || "",
    telefono: r.telefono,
    fecha: r.fecha,
    horaInicio: String(r.hora_inicio || "00:00").slice(0, 5),
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
    notas: r.notas || "",
    origen: r.origen || "trabajador",
    tipoCobro: r.tipo_cobro || "unico",
  };
}
function marcarInicioSesion() {
  try {
    const ahora = String(Date.now());
    localStorage.setItem(CLAVE_SESION_INI, ahora);
    localStorage.setItem(CLAVE_ULT_ACT, ahora);
  } catch (e) {}
}
function renovarInactividad() {
  try {
    localStorage.setItem(CLAVE_ULT_ACT, String(Date.now()));
  } catch (e) {}
}
function registrarActividad() {
  try {
    localStorage.setItem(CLAVE_ULT_ACT, String(Date.now()));
  } catch (e) {}
}
["click", "keydown", "scroll", "touchstart"].forEach((evt) => {
  window.addEventListener(evt, debounce(registrarActividad, 1000), {
    passive: true,
  });
});
function sesionCaducada() {
  return msSesionRestante() <= 0;
}
function msSesionRestante() {
  let ini = 0,
    ult = 0;
  try {
    ini = parseInt(localStorage.getItem(CLAVE_SESION_INI), 10) || 0;
    ult = parseInt(localStorage.getItem(CLAVE_ULT_ACT), 10) || ini;
  } catch (e) {}
  const ahora = Date.now();
  const restanteMax = ini ? ini + SESION_MAX_MS - ahora : Infinity;
  const restanteInac = ult ? ult + INACTIVIDAD_MAX_MS - ahora : Infinity;
  return Math.min(restanteMax, restanteInac);
}
let _intervaloVigilancia = null;
let _avisoSesionActivo = false;
function iniciarVigilanciaSesion() {
  if (_intervaloVigilancia) return;
  _intervaloVigilancia = setInterval(async () => {
    if (!usuarioSesion) return;
    let ini = 0,
      ult = 0;
    try {
      ini = parseInt(localStorage.getItem(CLAVE_SESION_INI), 10) || 0;
      ult = parseInt(localStorage.getItem(CLAVE_ULT_ACT), 10) || ini;
    } catch (e) {}
    const ahora = Date.now();
    const restanteMax = ini ? ini + SESION_MAX_MS - ahora : Infinity;
    const restanteInac = ult ? ult + INACTIVIDAD_MAX_MS - ahora : Infinity;
    const restante = Math.min(restanteMax, restanteInac);

    if (restante <= 0) {
      const motivo =
        restanteMax <= 0 ? "max" : restanteInac <= 0 ? "inac" : null;
      cerrarSesion();
      toast(
        motivo === "max"
          ? "La sesión ha alcanzado el máximo de 8 h. Vuelve a entrar."
          : "La sesión ha caducado por inactividad. Vuelve a entrar.",
        "warn",
      );
      return;
    }
    if (
      restanteInac <= AVISO_SESION_MS &&
      restanteMax > AVISO_SESION_MS &&
      !_avisoSesionActivo
    ) {
      _avisoSesionActivo = true;
      const seg = Math.ceil(restanteInac / 1000);
      const ok = await customConfirm(
        `Tu sesión caducará en ${seg} segundos por inactividad. ¿Quieres seguir conectado?`,
        "Sesión a punto de caducar",
      );
      _avisoSesionActivo = false;
      if (ok) {
        renovarInactividad();
        toast("Sesión renovada", "ok");
      } else {
        cerrarSesion();
      }
    }
  }, 15000);
}
function detenerVigilanciaSesion() {
  if (_intervaloVigilancia) {
    clearInterval(_intervaloVigilancia);
    _intervaloVigilancia = null;
  }
  _avisoSesionActivo = false;
}
function inicializarFechaHoy() {
  $("fechaCuadrante").value = fechaLocalISO();
}
function obtenerCierreMin(iso) {
  const dateIso =
    iso || ($("fechaCuadrante") ? $("fechaCuadrante").value : fechaLocalISO());
  const [y, m, d] = dateIso.split("-").map(Number);
  const day = new Date(y, m - 1, d, 12).getDay();
  if (day >= 1 && day <= 4) return CIERRE_SEMANA_MIN;
  return CIERRE_FINDE_MIN;
}
function debounce(fn, ms) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}
function rangoDiaISO(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return [
    new Date(y, m - 1, d, 0, 0, 0).toISOString(),
    new Date(y, m - 1, d + 1, 0, 0, 0).toISOString(),
  ];
}
function timeToMin(tStr) {
  const parts = String(tStr || "0:0").split(":");
  return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
}
function minToTimeStr(min) {
  const h = Math.floor(min / 60),
    m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function esCerrado(min, iso) {
  const cierre = obtenerCierreMin(iso);
  return (
    min < RESERVA_INI_MIN ||
    (min >= bloqueDescansoInicio && min < bloqueDescansoFin) ||
    min >= cierre
  );
}
function esFranjaBloqueada(iniMin, finMin, tipoReserva = "Normal", iso) {
  const cierre = obtenerCierreMin(iso);
  if (tipoReserva === "Torneo" || tipoReserva === "Entrenamiento")
    return iniMin < APERT_MIN || finMin > 24 * 60;
  if (iniMin < RESERVA_INI_MIN || finMin > cierre) return true;
  if (iniMin < bloqueDescansoFin && finMin > bloqueDescansoInicio) return true;
  return false;
}
let _ppmCache = null;
function pxPorMin() {
  if (_ppmCache !== null) return _ppmCache;
  const v = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue("--slot-h"),
  );
  _ppmCache = (v || 30) / 30;
  return _ppmCache;
}
window.addEventListener(
  "resize",
  () => {
    _ppmCache = null;
  },
  { passive: true },
);
function esFinde(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const w = new Date(y, m - 1, d, 12).getDay();
  return w === 0 || w === 6;
}
function abrirOverlay(id) {
  const ov = $(id);
  if (!ov) return;
  if (ov.tagName === "DIALOG") {
    if (!ov.open) ov.showModal();
  } else {
    ov.classList.add("open");
  }
  document.body.style.overflow = "hidden";
}
function cerrarOverlay(id) {
  const ov = $(id);
  if (!ov) return;
  if (ov.tagName === "DIALOG") {
    if (ov.open) ov.close();
  } else {
    ov.classList.remove("open");
  }
  if (
    !document.querySelector("dialog.modal-overlay[open], .modal-overlay.open")
  ) {
    document.body.style.overflow = "";
  }
}
document.querySelectorAll("dialog.modal-overlay").forEach((dlg) => {
  dlg.addEventListener("close", () => {
    if (
      !document.querySelector("dialog.modal-overlay[open], .modal-overlay.open")
    ) {
      document.body.style.overflow = "";
    }
  });
});
