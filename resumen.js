/* © Geopadel · Todos los derechos reservados. Queda prohibida la reproducción total o parcial sin autorización. */
async function entrarResumen() {
  if (!usuarioSesion) return;
  dibujarResumen();
  try {
    if (!limpiezas.length) await cargarLimpiezas(false);
  } catch (e) {
    console.error(e);
  }
  dibujarResumen();
}
function resumenSaludo() {
  const e = new Date().getHours();
  return e < 12 ? "Buenos días" : e < 20 ? "Buenas tardes" : "Buenas noches";
}
function resumenReservasProximas() {
  const e = new Date(),
    t = e.getHours() * 60 + e.getMinutes();
  return (datosLocales.reservas || [])
    .filter((e) => {
      const [n, r] = String(e.horaInicio || "00:00")
        .split(":")
        .map(Number);
      return n * 60 + r + (parseInt(e.duracionMin, 10) || 90) >= t;
    })
    .sort((e, t) => String(e.horaInicio).localeCompare(String(t.horaInicio)));
}
function dibujarResumen() {
  const e = $("resumenContenido");
  if (!e) return;
  const t = usuarioSesion ? usuarioSesion.nombre || usuarioSesion.user : "",
    n = t.split(" ")[0] || t,
    r = datosLocales.caja || {
      totalEfectivo: 0,
      totalTarjeta: 0,
      totalGeneral: 0,
    },
    i = datosLocales.reservas || [],
    a = resumenReservasProximas(),
    s = (typeof deudas !== "undefined" ? deudas : []).filter(
      (e) => e.estado !== "Resuelta",
    ),
    l = s.reduce((e, t) => e + (Number(t.importe) || 0), 0),
    c = typeof limpiezasVencidas === "function" ? limpiezasVencidas() : [],
    d = c.reduce((e, t) => e + t.items.length, 0),
    u = fechaBonita(fechaLocalISO(), !0);
  let p = "";
  if (d > 0)
    p += `<div class="res-alerta res-alerta-warn"><i class="ri-brush-line" aria-hidden="true"></i><div><b>${d} ${d === 1 ? "limpieza pendiente" : "limpiezas pendientes"}</b><p>Hay pistas sin limpiar en las últimas 2 semanas.</p></div><button type="button" class="btn-add" data-ir="limpieza">Ir a Limpieza</button></div>`;
  if (l > 0)
    p += `<div class="res-alerta"><i class="ri-wallet-3-line" aria-hidden="true"></i><div><b>${eur(l)} en deudas pendientes</b><p>${s.length} ${s.length === 1 ? "cliente" : "clientes"} con pagos pendientes.</p></div><button type="button" class="btn-add" data-ir="deudas">Ir a Deudas</button></div>`;
  let m;
  if (a.length)
    m = a
      .slice(0, 6)
      .map((e) => {
        const t = parseInt(e.duracionMin, 10) || 90,
          n = timeToMin(e.horaInicio),
          r = minToTimeStr(n + t),
          a =
            '<span class="badge-confirmada"><i class="ri-check-line" aria-hidden="true"></i>Confirmada</span>';
        return `<li class="res-agenda-item"><div class="res-agenda-hora"><b>${esc(e.horaInicio)}</b><small>${esc(r)}</small></div><div class="res-agenda-info"><b>${esc(e.pista)}</b><span>${esc(e.cliente)}</span></div><div class="res-agenda-estado">${a}</div></li>`;
      })
      .join("");
  else m = '<li class="res-agenda-vacia">No hay más reservas para hoy.</li>';
  const h = typeof esJefa === "function" && !esJefa(),
    f = h
      ? '<button type="button" class="res-accion" data-ir="fichajes"><i class="ri-time-line" aria-hidden="true"></i><span>Fichar</span></button>'
      : "";
  e.innerHTML = `<div class="res-bienvenida"><div><h2>${resumenSaludo()}, ${esc(n)}</h2><p>${esc(u)} · Aquí tienes el resumen del día.</p></div></div><div class="res-kpis"><div class="res-kpi res-kpi-green"><span><i class="ri-money-euro-circle-line" aria-hidden="true"></i>Ingresos hoy</span><h3>${eur(r.totalGeneral)}</h3><small>${eur(r.totalEfectivo)} efectivo · ${eur(r.totalTarjeta)} tarjeta</small></div><div class="res-kpi res-kpi-red"><span><i class="ri-wallet-3-line" aria-hidden="true"></i>Deudas pendientes</span><h3>${eur(l)}</h3><small>${s.length} ${s.length === 1 ? "cliente" : "clientes"}</small></div><div class="res-kpi res-kpi-amber"><span><i class="ri-brush-line" aria-hidden="true"></i>Limpiezas</span><h3>${c.length}</h3><small>${d === 0 ? "Todo al día" : `${d} ${d === 1 ? "tarea pendiente" : "tareas pendientes"}`}</small></div></div>${p ? `<div class="res-alertas">${p}</div>` : ""}<div class="res-acciones"><h3><i class="ri-flashlight-line" aria-hidden="true"></i>Acciones rápidas</h3><div class="res-acciones-grid"><button type="button" class="res-accion" data-ir="nueva-reserva"><i class="ri-add-line" aria-hidden="true"></i><span>Nueva reserva</span></button><button type="button" class="res-accion" data-ir="tienda"><i class="ri-goblet-line" aria-hidden="true"></i><span>Abrir bar</span></button><button type="button" class="res-accion" data-ir="caja"><i class="ri-lock-line" aria-hidden="true"></i><span>Cerrar caja</span></button>${f}</div></div><div class="res-agenda"><h3><i class="ri-list-ordered" aria-hidden="true"></i>Próximas reservas</h3><ul class="res-agenda-lista">${m}</ul></div>`;
}
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-ir]");
  if (!t) return;
  const n = t.dataset.ir;
  if (n === "nueva-reserva") {
    if (typeof abrirModalNuevaReserva === "function") abrirModalNuevaReserva();
    return;
  }
  if (typeof cambiarPestana === "function") cambiarPestana(n);
});
