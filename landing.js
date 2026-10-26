/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
const SB_HEADERS = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: "Bearer " + SUPABASE_ANON_KEY,
  },
  MAPA_TARIFAS = {
    "Entre semana mañana": "semanaManana",
    "Entre semana tarde": "semanaTarde",
    "Fin de semana": "finde",
  };
let _landingAntelacion = 120;
function formatearPrecio(e) {
  return Number(e).toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}
function hoyISO() {
  const e = new Date();
  return `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, "0")}-${String(e.getDate()).padStart(2, "0")}`;
}
function timeToMinLanding(e) {
  const [t, n] = String(e).split(":").map(Number);
  return (t || 0) * 60 + (n || 0);
}
async function cargarAntelacionLanding() {
  try {
    const e = await fetch(SUPABASE_URL + "/rest/v1/rpc/web_config", {
      method: "POST",
      headers: { ...SB_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!e.ok) return;
    const t = await e.json();
    if (t && Number.isFinite(Number(t.anticipacion_min)))
      _landingAntelacion = Number(t.anticipacion_min);
  } catch (e) {}
}
async function cargarTarifas() {
  try {
    const e = await fetch(
      SUPABASE_URL +
        "/rest/v1/tarifas?select=franja,precio_60min,precio_90min,precio_120min",
      { headers: SB_HEADERS },
    );
    if (!e.ok) throw new Error("HTTP " + e.status);
    const t = await e.json();
    (t || []).forEach((e) => {
      const t = MAPA_TARIFAS[e.franja];
      if (!t) return;
      [
        ["60", e.precio_60min],
        ["90", e.precio_90min],
        ["120", e.precio_120min],
      ].forEach(([e, n]) => {
        const r = document.querySelector(`[data-tarifa="${t}-${e}"]`);
        if (r && n !== null && n !== undefined && n !== "")
          r.textContent = formatearPrecio(n);
      });
    });
  } catch (e) {}
}
async function cargarHuecosHoy() {
  const e = document.getElementById("huecosHoy");
  if (!e) return;
  try {
    const t = hoyISO(),
      n = await fetch(SUPABASE_URL + "/rest/v1/rpc/web_disponibilidad", {
        method: "POST",
        headers: { ...SB_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({ p_fecha: t }),
      });
    if (!n.ok) throw new Error("HTTP " + n.status);
    const r = await n.json();
    if (!r || !r.ok || !Array.isArray(r.slots)) {
      e.innerHTML = `<p class="huecos-vacio">${t("huecos.error")} <a href="reservar">${t("huecos.ver")}</a></p>`;
      return;
    }
    const i = Date.now(),
      a = r.slots
        .map((e) => ({
          hora: e.hora,
          iniMin: timeToMinLanding(e.hora),
          opciones: (e.opciones || []).filter(
            (n) =>
              horarioPermitidoReserva(t, timeToMinLanding(e.hora), n.dur) &&
              new Date(`${t}T${e.hora}:00`).getTime() - i >=
                _landingAntelacion * 6e4,
          ),
        }))
        .filter((e) => e.opciones.length);
    if (!a.length) {
      e.innerHTML = `<p class="huecos-vacio">${t("landing.sin-huecos")} <a href="reservar">${t("landing.otros-dias")}</a></p>`;
      return;
    }
    e.innerHTML = a
      .slice(0, 12)
      .map((e) => {
        const n = Math.min(...e.opciones.map((e) => Number(e.precio) || 0));
        return `<a class="hueco-chip" href="reservar" aria-label="Reservar a las ${e.hora} ${t("landing.desde")} ${formatearPrecio(n)}">${e.hora}<span style="font-size:12px;font-weight:700;letter-spacing:.01em">${t("landing.desde")} ${formatearPrecio(n)}</span></a>`;
      })
      .join("");
  } catch (t) {
    console.warn("No se pudo cargar la disponibilidad:", t);
    e.innerHTML = `<p class="huecos-vacio">${t("landing.no-disponible")} <a href="reservar">${t("huecos.ver")}</a></p>`;
  }
}
function iniciarLanding() {
  const e = window.requestIdleCallback || ((e) => setTimeout(e, 1200));
  e(
    async () => {
      await cargarAntelacionLanding();
      cargarTarifas();
      cargarHuecosHoy();
    },
    { timeout: 3e3 },
  );
}
if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", iniciarLanding);
else iniciarLanding();
