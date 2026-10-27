/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
const DOMINIO_LOGIN = "@geopadel.app";
const SESION_MAX_MS = 8 * 3600 * 1000;
const INACTIVIDAD_MAX_MS = 8 * 3600 * 1000;
const AVISO_SESION_MS = 2 * 60 * 1000;
const CLAVE_ULT_ACT = "gp-ult-actividad";
const CLAVE_SESION_INI = "gp-sesion-ini";
const APERT_MIN = 8 * 60;
const bloqueDescansoInicio = 14 * 60;
const bloqueDescansoFin = 17 * 60;
const listaPistas = [
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
const listaMesas = [
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
};
const TARIFAS_IDS = {
  semanaManana: ["tarSemMan60", "tarSemMan", "tarSemMan120"],
  semanaTarde: ["tarSemTar60", "tarSemTar", "tarSemTar120"],
  finde: ["tarFinde60", "tarFinde", "tarFinde120"],
};
const TARIFAS_FRANJAS = {
  semanaManana: "Entre semana mañana",
  semanaTarde: "Entre semana tarde",
  finde: "Fin de semana",
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
  if (day >= 1 && day <= 4) return 23 * 60 + 30;
  return 22 * 60;
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
    min < 9 * 60 ||
    (min >= bloqueDescansoInicio && min < bloqueDescansoFin) ||
    min >= cierre
  );
}
function esFranjaBloqueada(iniMin, finMin, tipoReserva = "Normal", iso) {
  const cierre = obtenerCierreMin(iso);
  if (tipoReserva === "Torneo") return iniMin < 8 * 60 || finMin > 24 * 60;
  if (iniMin < 9 * 60 || finMin > cierre) return true;
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
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg) dlg.close();
  });
});
