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
let _landingAntelacion = 30;
function formatearPrecio(e) {
  return Number(e).toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}
function hoyISO() {
  return ahoraMadrid().fecha;
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
  const box = document.getElementById("huecosHoy");
  if (!box) return;
  try {
    const hoy = hoyISO(),
      res = await fetch(SUPABASE_URL + "/rest/v1/rpc/web_disponibilidad", {
        method: "POST",
        headers: { ...SB_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({ p_fecha: hoy }),
      });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    if (!data || !data.ok || !Array.isArray(data.slots)) {
      box.innerHTML = `<p class="huecos-vacio">${t("huecos.error")} <a href="reservar">${t("huecos.ver")}</a></p>`;
      return;
    }
    const ahora = ahoraMadrid().msUTC,
      slots = data.slots
        .map((s) => ({
          hora: s.hora,
          iniMin: timeToMinLanding(s.hora),
          opciones: (s.opciones || []).filter((o) => {
            const ini = timeToMinLanding(s.hora);
            const iniMs = Date.UTC(
              +hoy.slice(0, 4),
              +hoy.slice(5, 7) - 1,
              +hoy.slice(8, 10),
              Math.floor(ini / 60),
              ini % 60,
            );
            return iniMs - ahora >= _landingAntelacion * 6e4;
          }),
        }))
        .filter((s) => s.opciones.length);
    if (!slots.length) {
      box.innerHTML = `<p class="huecos-vacio">${t("landing.sin-huecos")} <a href="reservar">${t("landing.otros-dias")}</a></p>`;
      return;
    }
    box.innerHTML = slots
      .slice(0, 12)
      .map((s) => {
        const opcionBarata = s.opciones.reduce(
          (min, o) =>
            (Number(o.precio) || 0) < (Number(min.precio) || 0) ? o : min,
          s.opciones[0],
        );
        const precioMin = Number(opcionBarata.precio) || 0;
        const durTxt =
          opcionBarata.dur === 60
            ? "60 min"
            : opcionBarata.dur === 90
              ? "90 min"
              : `${opcionBarata.dur} min`;
        return `<a class="hueco-chip" href="reservar?fecha=${hoy}&hora=${s.hora}&dur=${opcionBarata.dur}" aria-label="Reservar a las ${s.hora} (${durTxt}) ${t("landing.desde")} ${formatearPrecio(precioMin)}">${s.hora}<span class="hueco-chip-precio">${t("landing.desde")} ${formatearPrecio(precioMin)}</span></a>`;
      })
      .join("");
  } catch (err) {
    console.warn("No se pudo cargar la disponibilidad:", err);
    box.innerHTML = `<p class="huecos-vacio">${t("landing.no-disponible")} <a href="reservar">${t("huecos.ver")}</a></p>`;
  }
}
function iniciarLanding() {
  const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1200));
  idle(
    async () => {
      await Promise.all([
        cargarAntelacionLanding(),
        cargarTarifas(),
        cargarHuecosHoy(),
      ]);
    },
    { timeout: 3e3 },
  );
}
if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", iniciarLanding);
else iniciarLanding();
