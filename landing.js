/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
const SB_HEADERS = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: "Bearer " + SUPABASE_ANON_KEY,
};
const MAPA_TARIFAS = {
  "Entre semana mañana": "semanaManana",
  "Entre semana tarde": "semanaTarde",
  "Fin de semana": "finde",
};

let _landingAntelacion = 30;
let _huecos = { fecha: null, dia: null, data: null, error: false };

function formatearPrecio(v) {
  return Number(v).toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function duracionLabel(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

function getTargetFecha() {
  const ahora = ahoraMadrid();
  if (ahora.h >= 22)
    return { dia: "manana", fecha: sumarDiasISO(ahora.fecha, 1) };
  return { dia: "hoy", fecha: ahora.fecha };
}

async function cargarAntelacionLanding() {
  try {
    const r = await fetch(SUPABASE_URL + "/rest/v1/rpc/web_config", {
      method: "POST",
      headers: { ...SB_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!r.ok) return;
    const d = await r.json();
    if (d && Number.isFinite(Number(d.anticipacion_min)))
      _landingAntelacion = Number(d.anticipacion_min);
  } catch (e) {}
}

async function cargarTarifasLanding() {
  const cont = document.querySelector(".tarifas-container");
  try {
    const r = await fetch(
      SUPABASE_URL +
        "/rest/v1/tarifas?select=franja,precio_60min,precio_90min,precio_120min",
      { headers: SB_HEADERS },
    );
    if (!r.ok) throw new Error("HTTP " + r.status);
    const rows = await r.json();
    (rows || []).forEach((row) => {
      const k = MAPA_TARIFAS[row.franja];
      if (!k) return;
      [
        ["60", row.precio_60min],
        ["90", row.precio_90min],
        ["120", row.precio_120min],
      ].forEach(([dur, precio]) => {
        if (precio === null || precio === undefined || precio === "") return;
        const el = document.querySelector(`[data-tarifa="${k}-${dur}"]`);
        if (!el) return;
        el.textContent = formatearPrecio(precio);
        el.classList.remove("skeleton");
      });
    });
  } catch (e) {
    document.querySelectorAll(".tarifa-value.skeleton").forEach((el) => {
      el.textContent = "—";
      el.classList.remove("skeleton");
    });
  } finally {
    if (cont) cont.classList.remove("loading");
  }
}

async function fetchHuecos(fecha) {
  const r = await fetch(SUPABASE_URL + "/rest/v1/rpc/web_disponibilidad", {
    method: "POST",
    headers: { ...SB_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({ p_fecha: fecha }),
  });
  if (!r.ok) throw new Error("HTTP " + r.status);
  const data = await r.json();
  if (!data || !data.ok || !Array.isArray(data.slots))
    throw new Error("Respuesta inválida");
  return data.slots;
}

function slotsVisibles(slots, fecha) {
  const ahora = ahoraMadrid();
  const esHoy = fecha === ahora.fecha;
  return slots
    .map((s) => {
      const [h, m] = String(s.hora).split(":").map(Number);
      const iniMin = (h || 0) * 60 + (m || 0);
      const opciones = (s.opciones || []).filter((o) => {
        if (!esHoy) return true;
        return iniMin - ahora.minutos >= _landingAntelacion;
      });
      return { hora: s.hora, iniMin, opciones };
    })
    .filter((s) => s.opciones.length > 0);
}

function opcionMasBarata(opciones) {
  return opciones.reduce(
    (min, o) => ((Number(o.precio) || 0) < (Number(min.precio) || 0) ? o : min),
    opciones[0],
  );
}

function renderHuecos() {
  const cont = document.getElementById("huecosHoy");
  const titulo = document.getElementById("huecosTitulo");
  if (titulo)
    titulo.textContent =
      _huecos.dia === "hoy"
        ? t("landing.huecosHoy")
        : t("landing.huecosManana");
  if (!cont) return;
  if (_huecos.error) {
    cont.innerHTML = `<p class="huecos-vacio">${t("huecos.error")} <a href="reservar">${t("huecos.ver")}</a></p>`;
    return;
  }
  if (!_huecos.data) {
    cont.innerHTML = `<p class="huecos-cargando">${t("huecos.cargando")}</p>`;
    return;
  }
  const vis = slotsVisibles(_huecos.data, _huecos.fecha);
  if (!vis.length) {
    cont.innerHTML = `<p class="huecos-vacio">${
      _huecos.dia === "hoy"
        ? t("landing.sin-huecos")
        : t("landing.sin-huecos-manana")
    } <a href="reservar">${t("landing.otros-dias")}</a></p>`;
    return;
  }
  cont.innerHTML = vis
    .slice(0, 12)
    .map((s) => {
      const op = opcionMasBarata(s.opciones);
      const libres = Number(op.libres) || 1;
      const durTxt = duracionLabel(op.dur);
      const libresTxt =
        libres > 1 ? ` · ${libres} ${t("reservar.numPistas.disponibles")}` : "";
      return `<a class="hueco-chip" href="reservar?fecha=${_huecos.fecha}&hora=${s.hora}&dur=${op.dur}" aria-label="${s.hora} ${durTxt}">
        <b>${s.hora}</b>
        <span class="hueco-chip-precio">${formatearPrecio(op.precio)}</span>
        <small>${durTxt}${libresTxt}</small>
      </a>`;
    })
    .join("");
}

async function initHuecos() {
  const { dia, fecha } = getTargetFecha();
  _huecos = { fecha, dia, data: null, error: false };
  try {
    _huecos.data = await fetchHuecos(fecha);
  } catch (e) {
    _huecos.error = true;
    console.warn("No se pudo cargar la disponibilidad:", e);
  }
  renderHuecos();
}

function initLanding() {
  const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1200));
  idle(
    async () => {
      await Promise.all([
        cargarAntelacionLanding(),
        cargarTarifasLanding(),
        initHuecos(),
      ]);
    },
    { timeout: 3000 },
  );
  document.addEventListener("idioma-cambiado", () => {
    renderHuecos();
  });
}

if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", initLanding);
else initLanding();
